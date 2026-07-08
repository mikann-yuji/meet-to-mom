import PhaserGame from "@/components/PhaserGame";

export default function Home() {
  return (
    <main className="page">
      <section className="game-shell" aria-label="2D browser game prototype">
        <div className="hud">
          <div>
            <h1>Meet To Mom</h1>
            <p>ねこの状態を切り替えて、右端のゴールへ進もう。</p>
          </div>
          <dl>
            <div>
              <dt>Move</dt>
              <dd>A/D or ←/→</dd>
            </div>
            <div>
              <dt>Jump / Rise</dt>
              <dd>Space</dd>
            </div>
            <div>
              <dt>State</dt>
              <dd>1 固体 / 2 液体 / 3 気体</dd>
            </div>
          </dl>
        </div>
        <PhaserGame />
      </section>
    </main>
  );
}
