interface JsonLdScriptProps {
  data: Record<string, unknown>;
}

// JSON.stringify는 '<'를 이스케이프하지 않으므로, 콘텐츠에 '</script>' 같은
// 시퀀스가 들어가면 스크립트 컨텍스트를 탈출할 수 있다.
// 주입 직전에 '<'를 유니코드 이스케이프로 치환해 차단한다 (JSON 의미는 동일).
function serializeJsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function JsonLdScript({ data }: JsonLdScriptProps) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
