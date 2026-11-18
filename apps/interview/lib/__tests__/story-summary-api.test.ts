import { POST } from '../../app/api/story-summary/route';
import { authorizeRequest } from '../authorize-request';

jest.mock('../authorize-request');
const originalKey = process.env.OPENAI_API_KEY;
afterEach(() => {
  jest.restoreAllMocks();
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
});
const request = (body: string) => new Request('https://example.com/api/story-summary', { method: 'POST', body });
it('checks access and input before contacting OpenAI', async () => {
  const upstream = jest.spyOn(global, 'fetch');
  jest.mocked(authorizeRequest).mockResolvedValue(401);
  expect((await POST(request('answer'))).status).toBe(401);
  jest.mocked(authorizeRequest).mockResolvedValue(200);
  expect((await POST(request(' '))).status).toBe(400);
  expect(upstream).not.toHaveBeenCalled();
});
it('returns completed text and reports upstream quota errors', async () => {
  jest.mocked(authorizeRequest).mockResolvedValue(200);
  process.env.OPENAI_API_KEY = 'test';
  jest
    .spyOn(global, 'fetch')
    .mockResolvedValueOnce(
      Response.json({
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: '한 줄\n요약.' }] }],
      })
    )
    .mockResolvedValueOnce(new Response(null, { status: 429 }));
  expect(await (await POST(request('answer'))).json()).toEqual({ summary: '한 줄 요약.' });
  expect((await POST(request('answer'))).status).toBe(429);
});
