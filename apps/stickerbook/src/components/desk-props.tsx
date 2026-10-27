import { useState } from 'react';

export function DeskProps({ onMessage }: { onMessage: (message: string) => void }) {
  const [coffee, setCoffee] = useState(false);
  const [shot, setShot] = useState(0);
  const [pencil, setPencil] = useState(false);
  return (
    <aside className="desk-props" aria-label="책상 소품">
      <button
        type="button"
        className={`coffee prop ${coffee ? 'coffee-moved' : ''}`}
        aria-label="커피잔 움직이기"
        onClick={() => {
          setCoffee(!coffee);
          onMessage(coffee ? '커피잔을 제자리에 놓았어요.' : '커피 한 모금. 책상에 작은 자국이 남았어요.');
        }}
      >
        <span className="coffee-ring" />
        <span className="saucer">
          <span className="cup">
            <span className="coffee-surface" />
          </span>
        </span>
      </button>
      <button
        type="button"
        className="camera prop"
        aria-label="카메라 셔터 누르기"
        onClick={() => {
          setShot(shot + 1);
          onMessage('찰칵. 이 순간도 한 장.');
        }}
      >
        <span className="camera-top" />
        <span className="camera-body">
          <span className="camera-name">MUMAK 35</span>
          <span className="camera-lens" key={shot}>
            <span />
          </span>
          <span className="camera-window" />
        </span>
      </button>
      <button
        type="button"
        className={`pencil prop ${pencil ? 'pencil-rolled' : ''}`}
        aria-label="연필 굴리기"
        onClick={() => {
          setPencil(!pencil);
          onMessage('연필이 데굴, 굴러갔어요.');
        }}
      >
        <span />
      </button>
    </aside>
  );
}
