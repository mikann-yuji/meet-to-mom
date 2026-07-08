"use client";

import { PointerEvent, useEffect, useRef } from "react";

type PhaserModule = typeof import("phaser");
type PhaserGameInstance = InstanceType<PhaserModule["Game"]>;

type CatState = "solid" | "liquid" | "gas";

type TouchControls = {
  left: boolean;
  right: boolean;
  jump: boolean;
  state: CatState | null;
};

type FlowZone = {
  x: number;
  y: number;
  width: number;
  height: number;
  forceX: number;
  forceY: number;
};

type SoundName = "jump" | "solid" | "liquid" | "gas" | "clear" | "hurt";

const WIDTH = 960;
const HEIGHT = 540;

const stateLabels: Record<CatState, string> = {
  solid: "固体",
  liquid: "液体",
  gas: "気体"
};

class SimpleSynth {
  private context: AudioContext | null = null;

  unlock() {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!this.context && AudioContextClass) {
      this.context = new AudioContextClass();
    }

    if (this.context?.state === "suspended") {
      void this.context.resume();
    }
  }

  play(name: SoundName) {
    this.unlock();

    if (!this.context || this.context.state !== "running") {
      return;
    }

    if (name === "jump") {
      this.tone(360, 680, 0.11, "square", 0.08);
    } else if (name === "solid") {
      this.tone(150, 92, 0.12, "triangle", 0.1);
    } else if (name === "liquid") {
      this.tone(420, 220, 0.16, "sine", 0.08);
      this.tone(620, 340, 0.08, "sine", 0.04, 0.03);
    } else if (name === "gas") {
      this.tone(540, 980, 0.22, "sine", 0.07);
    } else if (name === "clear") {
      this.tone(523, 659, 0.12, "triangle", 0.08);
      this.tone(659, 784, 0.12, "triangle", 0.08, 0.1);
      this.tone(784, 1046, 0.22, "triangle", 0.08, 0.2);
    } else {
      this.tone(180, 70, 0.22, "sawtooth", 0.07);
    }
  }

  private tone(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0
  ) {
    if (!this.context) {
      return;
    }

    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}

export default function PhaserGame() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef(new SimpleSynth());
  const controlsRef = useRef<TouchControls>({
    left: false,
    right: false,
    jump: false,
    state: null
  });

  const holdControl =
    (control: "left" | "right" | "jump", pressed: boolean) =>
    (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      audioRef.current.unlock();
      controlsRef.current[control] = pressed;
    };

  const requestState =
    (state: CatState) => (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      audioRef.current.unlock();
      controlsRef.current.state = state;
    };

  useEffect(() => {
    let game: PhaserGameInstance | null = null;
    let disposed = false;

    async function boot() {
      const Phaser = await import("phaser");

      if (disposed || !containerRef.current) {
        return;
      }

      class MainScene extends Phaser.Scene {
        private cat!: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
        private ears!: Phaser.GameObjects.Triangle[];
        private face!: Phaser.GameObjects.Text;
        private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
        private keyA!: Phaser.Input.Keyboard.Key;
        private keyD!: Phaser.Input.Keyboard.Key;
        private key1!: Phaser.Input.Keyboard.Key;
        private key2!: Phaser.Input.Keyboard.Key;
        private key3!: Phaser.Input.Keyboard.Key;
        private stateText!: Phaser.GameObjects.Text;
        private messageText!: Phaser.GameObjects.Text;
        private flowZones: FlowZone[] = [];
        private catState: CatState = "solid";
        private jumpWasDown = false;
        private cleared = false;

        constructor() {
          super("main");
        }

        create() {
          this.physics.world.setBounds(0, 0, WIDTH, HEIGHT);
          this.addSky();
          this.createCat();
          this.createLevel();
          this.createInput();
          this.createUi();
        }

        update() {
          if (this.cleared) {
            this.cat.setVelocityX(0);
            return;
          }

          const requestedState = controlsRef.current.state;
          if (requestedState) {
            this.setCatState(requestedState);
            controlsRef.current.state = null;
          }

          if (Phaser.Input.Keyboard.JustDown(this.key1)) {
            this.setCatState("solid");
          }
          if (Phaser.Input.Keyboard.JustDown(this.key2)) {
            this.setCatState("liquid");
          }
          if (Phaser.Input.Keyboard.JustDown(this.key3)) {
            this.setCatState("gas");
          }

          const body = this.cat.body;
          const left = this.cursors.left.isDown || this.keyA.isDown || controlsRef.current.left;
          const right = this.cursors.right.isDown || this.keyD.isDown || controlsRef.current.right;
          const jumpDown = this.cursors.space.isDown || controlsRef.current.jump;
          const jumpJustDown = Phaser.Input.Keyboard.JustDown(this.cursors.space) || (jumpDown && !this.jumpWasDown);
          const speed = this.catState === "gas" ? 88 : this.catState === "liquid" ? 150 : 205;

          if (left) {
            this.cat.setVelocityX(-speed);
          } else if (right) {
            this.cat.setVelocityX(speed);
          } else if (this.catState !== "liquid") {
            this.cat.setVelocityX(0);
          }

          if (this.catState === "gas") {
            body.setGravityY(-820);
            body.setMaxVelocity(105, 115);
            this.cat.setDragX(260);
            if (jumpJustDown) {
              audioRef.current.play("jump");
            }
            if (jumpDown) {
              this.cat.setVelocityY(-112);
            } else if (this.cat.body.velocity.y > -42) {
              this.cat.setVelocityY(-42);
            }
          } else {
            body.setGravityY(this.catState === "solid" ? 240 : 190);
            body.setMaxVelocity(520, 680);
            this.cat.setDragX(this.catState === "liquid" ? 90 : 1400);

            if (this.catState === "liquid") {
              this.applyLiquidFlow(left, right);
            }

            if (jumpJustDown && body.blocked.down) {
              this.cat.setVelocityY(this.catState === "solid" ? -390 : -245);
              audioRef.current.play("jump");
            }
          }

          this.jumpWasDown = jumpDown;
          this.syncCatParts();
        }

        private addSky() {
          this.cameras.main.setBackgroundColor("#202833");
          this.add.rectangle(WIDTH / 2, HEIGHT - 26, WIDTH, 52, 0x20242c).setScrollFactor(0);
          for (let i = 0; i < 14; i += 1) {
            this.add.circle(80 + i * 70, 78 + (i % 3) * 28, 2, 0xf6f2e8, 0.25);
          }
        }

        private createLevel() {
          const platforms = this.physics.add.staticGroup();
          const addBlock = (x: number, y: number, w: number, h: number, color = 0x44515f) => {
            const block = this.add.rectangle(x, y, w, h, color);
            platforms.add(block);
            return block;
          };
          const addSlope = (x: number, y: number, width: number, height: number, forceX: number) => {
            this.add
              .triangle(x, y, -width / 2, height / 2, width / 2, height / 2, width / 2, -height / 2, 0x4f5d6c)
              .setAlpha(0.95);
            this.add
              .line(x, y, -width / 2, height / 2, width / 2, -height / 2, 0x9fb1c3)
              .setLineWidth(4)
              .setAlpha(0.45);
            this.flowZones.push({
              x,
              y,
              width,
              height,
              forceX,
              forceY: 24
            });
          };

          addBlock(WIDTH / 2, 520, WIDTH, 40, 0x3a4654);
          addBlock(210, 430, 220, 28);
          addBlock(470, 374, 170, 28);
          addBlock(720, 330, 250, 28);
          addBlock(395, 474, 185, 52, 0x52606e);
          addBlock(585, 444, 190, 28, 0x52606e);
          addBlock(770, 474, 230, 52, 0x596675);
          addBlock(785, 407, 205, 24, 0x596675);
          addBlock(900, 250, 110, 28);
          addSlope(236, 495, 190, 80, 210);
          addSlope(535, 414, 145, 68, 190);

          const hazard = this.add.rectangle(610, 502, 70, 18, 0xd86b55);
          this.physics.add.existing(hazard, true);

          const goal = this.add.rectangle(914, 205, 34, 90, 0x74d49b, 0.8);
          this.add.rectangle(914, 154, 50, 12, 0xf0c65a);
          this.add.text(880, 96, "GOAL", {
            color: "#f6f2e8",
            fontFamily: "Arial",
            fontSize: "18px",
            fontStyle: "bold"
          });
          this.physics.add.existing(goal, true);

          this.physics.add.collider(this.cat, platforms);
          this.physics.add.collider(this.cat, hazard, () => this.resetCat());
          this.physics.add.overlap(this.cat, goal, () => this.clearGame());
        }

        private createCat() {
          const texture = this.make.graphics({ x: 0, y: 0 });
          texture.fillStyle(0xffffff);
          texture.fillRect(0, 0, 64, 64);
          texture.generateTexture("cat-body", 64, 64);
          texture.destroy();

          this.cat = this.physics.add.image(74, 456, "cat-body");
          this.cat.setCollideWorldBounds(true);
          this.cat.setTint(0xf0c65a);
          this.cat.setDragX(1400);
          this.cat.setDepth(5);

          this.ears = [
            this.add.triangle(0, 0, 0, 16, 10, 0, 20, 16, 0xf0c65a),
            this.add.triangle(0, 0, 0, 16, 10, 0, 20, 16, 0xf0c65a)
          ];
          this.face = this.add.text(0, 0, "^", {
            color: "#202833",
            fontFamily: "Arial",
            fontSize: "26px",
            fontStyle: "bold"
          });
          this.setCatState("solid");
        }

        private createInput() {
          this.cursors = this.input.keyboard!.createCursorKeys();
          this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
          this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
          this.key1 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
          this.key2 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
          this.key3 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
          this.input.keyboard!.on("keydown", () => audioRef.current.unlock());
        }

        private createUi() {
          this.stateText = this.add.text(18, 16, "", {
            color: "#f6f2e8",
            fontFamily: "Arial",
            fontSize: "18px",
            fontStyle: "bold"
          });
          this.messageText = this.add
            .text(WIDTH / 2, HEIGHT / 2 - 30, "", {
              align: "center",
              backgroundColor: "#111318",
              color: "#f6f2e8",
              fixedWidth: 420,
              fontFamily: "Arial",
              fontSize: "34px",
              fontStyle: "bold",
              padding: { x: 20, y: 16 }
            })
            .setOrigin(0.5)
            .setDepth(20)
            .setVisible(false);
          this.updateStateText();
        }

        private setCatState(nextState: CatState) {
          const previousState = this.catState;
          this.catState = nextState;
          const body = this.cat.body;

          if (nextState === "solid") {
            this.cat.setDisplaySize(42, 44).setTint(0xf0c65a);
            body.setSize(42, 44).setOffset(11, 10).setMass(2);
          } else if (nextState === "liquid") {
            this.cat.setDisplaySize(54, 24).setTint(0x63c6d8);
            body.setSize(54, 24).setOffset(5, 28).setMass(0.55);
          } else {
            this.cat.setDisplaySize(38, 42).setTint(0xd7d9f5);
            body.setSize(38, 42).setOffset(13, 11).setMass(0.2);
          }

          this.updateStateText();
          this.syncCatParts();

          if (previousState !== nextState) {
            audioRef.current.play(nextState);
          }
        }

        private applyLiquidFlow(left: boolean, right: boolean) {
          const activeZone = this.flowZones.find((zone) =>
            Phaser.Geom.Rectangle.Contains(
              new Phaser.Geom.Rectangle(
                zone.x - zone.width / 2,
                zone.y - zone.height / 2,
                zone.width,
                zone.height
              ),
              this.cat.x,
              this.cat.y + this.cat.displayHeight / 2
            )
          );

          if (!activeZone) {
            return;
          }

          const playerInput = left || right ? 0.45 : 1;
          this.cat.setVelocityX(this.cat.body.velocity.x + activeZone.forceX * playerInput * (1 / 60));
          this.cat.setVelocityY(Math.max(this.cat.body.velocity.y, activeZone.forceY));
        }

        private syncCatParts() {
          const x = this.cat.x;
          const y = this.cat.y;
          const bodyHeight = this.cat.displayHeight;
          const bodyWidth = this.cat.displayWidth;
          const earY = y - bodyHeight / 2 - 6;

          this.ears[0].setPosition(x - bodyWidth * 0.24, earY).setVisible(this.catState !== "liquid");
          this.ears[1].setPosition(x + bodyWidth * 0.24 - 20, earY).setVisible(this.catState !== "liquid");
          this.face.setPosition(x - 8, y - 18).setVisible(this.catState !== "liquid");
          if (this.catState === "gas") {
            this.cat.setAlpha(0.72);
            this.ears.forEach((ear) => ear.setAlpha(0.62));
            this.face.setAlpha(0.6);
          } else {
            this.cat.setAlpha(1);
            this.ears.forEach((ear) => ear.setAlpha(1));
            this.face.setAlpha(1);
          }
        }

        private updateStateText() {
          if (!this.stateText) {
            return;
          }
          this.stateText.setText(`状態: ${stateLabels[this.catState]}   1/2/3で変化`);
        }

        private resetCat() {
          audioRef.current.play("hurt");
          this.cat.setPosition(74, 456);
          this.cat.setVelocity(0, 0);
          this.setCatState("solid");
        }

        private clearGame() {
          this.cleared = true;
          audioRef.current.play("clear");
          this.messageText.setText("CLEAR!\nねこはゴールに到達した").setVisible(true);
          this.cat.setVelocity(0, 0);
        }
      }

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: WIDTH,
        height: HEIGHT,
        physics: {
          default: "arcade",
          arcade: {
            gravity: { x: 0, y: 720 },
            debug: false
          }
        },
        scene: MainScene,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH
        }
      });
    }

    boot();

    return () => {
      disposed = true;
      game?.destroy(true);
    };
  }, []);

  return (
    <div className="play-area">
      <div ref={containerRef} className="game-frame" />
      <div className="touch-controls" aria-label="スマホ用操作ボタン">
        <div className="touch-cluster">
          <button
            type="button"
            aria-label="左へ移動"
            onPointerDown={holdControl("left", true)}
            onPointerUp={holdControl("left", false)}
            onPointerCancel={holdControl("left", false)}
            onPointerLeave={holdControl("left", false)}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="右へ移動"
            onPointerDown={holdControl("right", true)}
            onPointerUp={holdControl("right", false)}
            onPointerCancel={holdControl("right", false)}
            onPointerLeave={holdControl("right", false)}
          >
            →
          </button>
        </div>
        <div className="touch-cluster state-cluster">
          <button type="button" aria-label="固体に変化" onPointerDown={requestState("solid")}>
            固
          </button>
          <button type="button" aria-label="液体に変化" onPointerDown={requestState("liquid")}>
            液
          </button>
          <button type="button" aria-label="気体に変化" onPointerDown={requestState("gas")}>
            気
          </button>
        </div>
        <button
          type="button"
          className="jump-button"
          aria-label="ジャンプまたは上昇"
          onPointerDown={holdControl("jump", true)}
          onPointerUp={holdControl("jump", false)}
          onPointerCancel={holdControl("jump", false)}
          onPointerLeave={holdControl("jump", false)}
        >
          JUMP
        </button>
      </div>
    </div>
  );
}
