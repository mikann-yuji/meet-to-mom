"use client";

import { useEffect, useRef } from "react";

type PhaserModule = typeof import("phaser");
type PhaserGameInstance = InstanceType<PhaserModule["Game"]>;

type CatState = "solid" | "liquid" | "gas";

const WIDTH = 960;
const HEIGHT = 540;

const stateLabels: Record<CatState, string> = {
  solid: "固体",
  liquid: "液体",
  gas: "気体"
};

export default function PhaserGame() {
  const containerRef = useRef<HTMLDivElement | null>(null);

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
        private catState: CatState = "solid";
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
          const left = this.cursors.left.isDown || this.keyA.isDown;
          const right = this.cursors.right.isDown || this.keyD.isDown;
          const speed = this.catState === "gas" ? 95 : this.catState === "liquid" ? 155 : 205;

          if (left) {
            this.cat.setVelocityX(-speed);
          } else if (right) {
            this.cat.setVelocityX(speed);
          } else {
            this.cat.setVelocityX(0);
          }

          if (this.catState === "gas") {
            body.setGravityY(-600);
            body.setMaxVelocity(120, 90);
            if (this.cursors.space.isDown) {
              this.cat.setVelocityY(-86);
            }
          } else {
            body.setGravityY(this.catState === "solid" ? 240 : 120);
            body.setMaxVelocity(500, 680);
            if (Phaser.Input.Keyboard.JustDown(this.cursors.space) && body.blocked.down) {
              this.cat.setVelocityY(this.catState === "solid" ? -390 : -285);
            }
          }

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

          addBlock(WIDTH / 2, 520, WIDTH, 40, 0x3a4654);
          addBlock(210, 430, 220, 28);
          addBlock(470, 374, 170, 28);
          addBlock(720, 330, 250, 28);
          addBlock(395, 474, 185, 52, 0x52606e);
          addBlock(585, 444, 190, 28, 0x52606e);
          addBlock(770, 474, 230, 52, 0x596675);
          addBlock(785, 407, 205, 24, 0x596675);
          addBlock(900, 250, 110, 28);

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
          this.catState = nextState;
          const body = this.cat.body;

          if (nextState === "solid") {
            this.cat.setDisplaySize(42, 44).setTint(0xf0c65a);
            body.setSize(42, 44).setOffset(11, 10).setMass(2);
          } else if (nextState === "liquid") {
            this.cat.setDisplaySize(54, 24).setTint(0x63c6d8);
            body.setSize(54, 24).setOffset(5, 28).setMass(0.8);
          } else {
            this.cat.setDisplaySize(38, 42).setTint(0xd7d9f5);
            body.setSize(38, 42).setOffset(13, 11).setMass(0.25);
          }

          this.updateStateText();
          this.syncCatParts();
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
          this.cat.setPosition(74, 456);
          this.cat.setVelocity(0, 0);
          this.setCatState("solid");
        }

        private clearGame() {
          this.cleared = true;
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

  return <div ref={containerRef} className="game-frame" />;
}
