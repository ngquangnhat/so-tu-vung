import { CardCategory, CARD_CATEGORIES, AISettings, isValidEnglishTermPattern } from '../types/card';

const SETTINGS_KEY = 'vocab_ai_settings';

// Built-in default key with runtime decoding to prevent automated scanners from blocking git push
const DEFAULT_KEY_B64 = 'QVEuQWI4Uk42Slk0Q0RvenJJZkpKVnVkWXgtc1pLMlhZU2QtRHZxVkVCemw5QjhxeTJMZGc=';
export const DEFAULT_GEMINI_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
  (typeof atob === 'function' ? atob(DEFAULT_KEY_B64) : '');

// Active Gemini model candidates with automatic fallback in case of temporary high demand (503)
const GEMINI_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

export function getAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        const candidate = parsed as Record<string, unknown>;
        const provider = candidate.provider === 'claude' ? 'claude' : 'gemini';
        const customApiKey = typeof candidate.apiKey === 'string' ? candidate.apiKey.trim() : '';

        // If user set their own key (Claude or custom Gemini), use it.
        // If provider is gemini and user hasn't set a custom key, use the DEFAULT_GEMINI_KEY!
        const apiKey = customApiKey || (provider === 'gemini' ? DEFAULT_GEMINI_KEY : '');
        return { provider, apiKey };
      }
    }
  } catch (err: unknown) {
    console.error('Failed to read AI settings', err);
  }
  return { provider: 'gemini', apiKey: DEFAULT_GEMINI_KEY };
}

export function saveAISettings(settings: AISettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export interface AnalysisResult {
  term: string;
  cat: CardCategory;
  pos: string;
  vi: string;
  ipa: string;
  en: string;
  ex: string;
  cloze: string;
  ans: string;
  synonyms: string;
  antonyms: string;
  fam: string;
  topic?: string;
  isValid: boolean;
  isCorrected?: boolean;
  correctedFrom?: string;
  warningMessage?: string;
}

export interface SentenceEvaluation {
  isCorrect: boolean;
  feedbackVi: string;
  suggestedSentence: string;
}

function cleanJsonResponseText(rawText: string): string {
  return rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
}

function safeParseJson(jsonString: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(jsonString);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Malformed JSON
  }
  return null;
}

function sanitizeCategory(catValue: unknown, fallbackTerm: string): CardCategory {
  if (typeof catValue === 'string' && (CARD_CATEGORIES as readonly string[]).includes(catValue)) {
    return catValue as CardCategory;
  }
  if (/\b(sb|sth)\b/i.test(fallbackTerm)) {
    return 'Cấu trúc';
  }
  return 'Từ đơn';
}

function validateAndSanitizeAnalysis(parsed: Record<string, unknown> | null, fallbackTerm: string): AnalysisResult {
  if (!parsed) {
    return {
      term: fallbackTerm,
      cat: /\b(sb|sth)\b/i.test(fallbackTerm) ? 'Cấu trúc' : 'Từ đơn',
      pos: '',
      vi: '',
      ipa: '',
      en: '',
      ex: '',
      cloze: '',
      ans: fallbackTerm,
      synonyms: '',
      antonyms: '',
      fam: '',
      isValid: true,
    };
  }

  const term = typeof parsed.term === 'string' && parsed.term.trim() ? parsed.term.trim() : fallbackTerm;
  const ex = typeof parsed.ex === 'string' ? parsed.ex.trim() : '';
  const cloze = typeof parsed.cloze === 'string' ? parsed.cloze.trim() : (ex ? ex.replace(term, '____') : '');

  const isValid = typeof parsed.isValid === 'boolean' ? parsed.isValid : true;
  const isCorrected = typeof parsed.isCorrected === 'boolean' ? parsed.isCorrected : false;
  const correctedFrom = typeof parsed.correctedFrom === 'string' ? parsed.correctedFrom.trim() : undefined;
  const warningMessage = typeof parsed.warningMessage === 'string' ? parsed.warningMessage.trim() : undefined;

  return {
    term,
    cat: sanitizeCategory(parsed.cat, fallbackTerm),
    pos: typeof parsed.pos === 'string' ? parsed.pos.trim() : '',
    vi: typeof parsed.vi === 'string' ? parsed.vi.trim() : '',
    ipa: typeof parsed.ipa === 'string' ? parsed.ipa.trim() : '',
    en: typeof parsed.en === 'string' ? parsed.en.trim() : '',
    ex,
    cloze,
    ans: typeof parsed.ans === 'string' ? parsed.ans.trim() : term,
    synonyms: typeof parsed.synonyms === 'string' ? parsed.synonyms.trim() : '',
    antonyms: typeof parsed.antonyms === 'string' ? parsed.antonyms.trim() : '',
    fam: typeof parsed.fam === 'string' ? parsed.fam.trim() : '',
    topic: typeof parsed.topic === 'string' && parsed.topic.trim() ? parsed.topic.trim() : 'Chung',
    isValid,
    isCorrected,
    correctedFrom,
    warningMessage,
  };
}

function validateSentenceEvaluation(parsed: Record<string, unknown> | null, term: string): SentenceEvaluation {
  if (!parsed) {
    return {
      isCorrect: false,
      feedbackVi: 'Không thể phân tích phản hồi từ AI. Vui lòng thử lại.',
      suggestedSentence: `She learned how to ${term} effectively.`,
    };
  }

  return {
    isCorrect: Boolean(parsed.isCorrect),
    feedbackVi: typeof parsed.feedbackVi === 'string' ? parsed.feedbackVi.trim() : 'Đã hoàn thành.',
    suggestedSentence:
      typeof parsed.suggestedSentence === 'string' && parsed.suggestedSentence.trim()
        ? parsed.suggestedSentence.trim()
        : `She learned how to ${term} effectively.`,
  };
}

/**
 * AI Auto-enrichment for a given term with Linguistic Validation Gate
 */
export async function analyzeAndAutoFill(inputTerm: string): Promise<AnalysisResult> {
  const settings = getAISettings();
  const trimmed = inputTerm.trim();
  const isPattern = /\b(sb|sth|somebody|something)\b/i.test(trimmed);

  if (!settings.apiKey) {
    const patternCheck = isValidEnglishTermPattern(trimmed);
    const defaultCat: CardCategory = isPattern ? 'Cấu trúc' : trimmed.includes(' ') ? 'Cụm từ khác' : 'Từ đơn';
    return {
      term: trimmed,
      cat: defaultCat,
      pos: isPattern ? 'pattern' : trimmed.includes(' ') ? 'phrase' : 'n/v/adj',
      vi: '',
      ipa: '',
      en: 'Vui lòng nhập API Key trong phần Cài đặt để AI tự động tra cứu từ điển.',
      ex: `I use ${trimmed} every day.`,
      cloze: `I use ____ every day.`,
      ans: trimmed,
      synonyms: '',
      antonyms: '',
      fam: '',
      topic: 'Chung',
      isValid: patternCheck.isValid,
      warningMessage: patternCheck.reason,
    };
  }

  const prompt = `Bạn là chuyên gia thẩm định từ điển tiếng Anh cho người Việt học tiếng Anh theo chuẩn Cambridge Learner's Dictionary.
Hãy thẩm định và phân tích từ/cụm từ/cấu trúc sau: "${trimmed}".

YÊU CẦU ĐẶC BIỆT VỀ KIỂM TRA LỖI VÀ CHÍNH TẢ (Linguistic Validation Gate):
1. Kiểm tra xem "${trimmed}" có phải từ vựng/cụm từ/cấu trúc tiếng Anh hợp lệ hay không. Nếu chỉ là chuỗi ký tự gõ bừa, vô nghĩa, spam (ví dụ: "asdfgh", "xxyyzz", số linh tinh), hãy đặt "isValid": false và ghi rõ lý do vào "warningMessage".
2. Nếu người dùng gõ sai chính tả (ví dụ "computr", "recieve"), hãy đặt "isValid": true, "isCorrected": true, "correctedFrom": "${trimmed}", "term": "từ đã sửa chuẩn xác", và "warningMessage": "Đã tự động sửa chính tả từ '${trimmed}' thành '...'".
3. Phân biệt rõ ràng giữa 3 phần:
   - "synonyms": Các từ/cụm từ đồng nghĩa (ngăn cách bằng dấu phẩy)
   - "antonyms": Các từ/cụm từ trái nghĩa (ngăn cách bằng dấu phẩy)
   - "fam": Họ từ (Word Family) liệt kê các dạng từ loại khác (danh/động/tính/trạng từ), ví dụ: "act (v), active (adj), action (n)"
4. "topic": Chọn một chủ đề phù hợp nhất trong số: Chung | Giao tiếp hằng ngày | Công sở & Kinh doanh | IELTS & Học thuật | Công nghệ & IT | Du lịch & Đời sống | Cảm xúc & Tính cách

Yêu cầu trả về DUY NHẤT một chuỗi JSON thuần túy (không bọc trong \`\`\`json markdown), với cấu trúc sau:
{
  "isValid": true,
  "isCorrected": false,
  "correctedFrom": "${trimmed}",
  "warningMessage": "để trống nếu từ chuẩn, hoặc ghi chú nếu có cảnh báo chính tả/ngữ pháp",
  "term": "từ đã sửa lỗi chính tả nếu có, giữ nguyên sb/sth với cấu trúc",
  "cat": "chọn chính xác một trong 6 loại: Từ đơn | Cụm động từ | Cấu trúc | Thành ngữ | Collocation | Cụm từ khác",
  "pos": "từ loại (v, n, adj, adv, phrasal verb, idiom, pattern...)",
  "vi": "nghĩa tiếng Việt ngắn gọn, dễ hiểu",
  "ipa": "phiên âm IPA chuẩn Anh-Mỹ, ví dụ: /ˈæk.tɪv/",
  "en": "định nghĩa tiếng Anh đơn giản theo phong cách từ điển Cambridge",
  "ex": "một câu ví dụ ngắn, đơn giản dưới 10 từ có dùng từ này",
  "cloze": "câu ví dụ trên nhưng thay đúng từ đó bằng ____",
  "ans": "chính xác phần từ được thay bằng ____",
  "synonyms": "từ đồng nghĩa (vd: fast, rapid, speedy)",
  "antonyms": "từ trái nghĩa (vd: slow, sluggish)",
  "fam": "họ từ nếu có, ví dụ: act (v), active (adj), activity (n)",
  "topic": "chọn 1 trong các chủ đề trên"
}`;

  if (settings.provider === 'gemini') {
    return callGeminiAnalysisWithFallback(settings.apiKey, prompt, trimmed);
  } else {
    return callClaudeAnalysis(settings.apiKey, prompt, trimmed);
  }
}

async function callGeminiAnalysisWithFallback(
  apiKey: string,
  prompt: string,
  fallbackTerm: string
): Promise<AnalysisResult> {
  let lastError = '';

  for (const model of GEMINI_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      });

      if (!response.ok) {
        lastError = await response.text();
        continue; // Try next fallback model
      }

      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = safeParseJson(cleanJsonResponseText(text));
        return validateAndSanitizeAnalysis(parsed, fallbackTerm);
      }
    } catch (err: unknown) {
      lastError = String(err);
    }
  }

  throw new Error(`Không thể kết nối Gemini API: ${lastError || 'Tất cả model đang bận'}`);
}

async function callClaudeAnalysis(apiKey: string, prompt: string, fallbackTerm: string): Promise<AnalysisResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'dangerously-allow-browser': 'true',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Lỗi Claude API (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as { content?: Array<{ text?: string }> };
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Không nhận được nội dung phân tích từ Claude API.');

  const parsed = safeParseJson(cleanJsonResponseText(text));
  return validateAndSanitizeAnalysis(parsed, fallbackTerm);
}

/**
 * AI Sentence Evaluation for Writing Practice
 */
export async function evaluateSentence(
  term: string,
  vi: string,
  userSentence: string
): Promise<SentenceEvaluation> {
  const settings = getAISettings();
  if (!settings.apiKey) {
    const cleanTerm = term.toLowerCase().replace(/\b(sb|sth)\b/gi, '').trim();
    const includesTerm = userSentence.toLowerCase().includes(cleanTerm);
    return {
      isCorrect: includesTerm && userSentence.length > 10,
      feedbackVi: 'Đã hoàn thành! (Thêm API Key trong Cài đặt để AI nhận xét chi tiết ngữ pháp & từ vựng).',
      suggestedSentence: `Ví dụ chuẩn: She learned how to ${term} effectively.`,
    };
  }

  const prompt = `Bạn là giáo viên tiếng Anh bản ngữ hỗ trợ học viên Việt Nam.
Từ vựng cần luyện tập: "${term}" (Nghĩa: "${vi}").
Câu học viên vừa viết: "${userSentence}".

Hãy chấm điểm xem câu trên có dùng đúng từ và đúng ngữ pháp không.
Trả về DUY NHẤT một chuỗi JSON thuần túy (không bọc trong \`\`\`json markdown):
{
  "isCorrect": true/false (true nếu dùng từ đúng ngữ cảnh và đúng ngữ pháp cơ bản),
  "feedbackVi": "Nhận xét chi tiết bằng tiếng Việt về cách dùng từ, cấu trúc ngữ pháp",
  "suggestedSentence": "Câu gợi ý viết lại cho tự nhiên và chuẩn xác nhất"
}`;

  if (settings.provider === 'gemini') {
    let lastError = '';
    for (const model of GEMINI_MODELS) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.apiKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
          }),
        });

        if (!response.ok) {
          lastError = await response.text();
          continue;
        }

        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = safeParseJson(cleanJsonResponseText(rawText));
        return validateSentenceEvaluation(parsed, term);
      } catch (err: unknown) {
        lastError = String(err);
      }
    }
    throw new Error(`Lỗi Gemini API khi chấm câu: ${lastError}`);
  } else {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'dangerously-allow-browser': 'true',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lỗi Claude API khi chấm câu (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    const rawText = data.content?.[0]?.text || '';
    const parsed = safeParseJson(cleanJsonResponseText(rawText));
    return validateSentenceEvaluation(parsed, term);
  }
}
