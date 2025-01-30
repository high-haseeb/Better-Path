// Written by high-haseeb <https://github.com/high-haseeb/>
// This file is part of project 'Better-Path'

import * as THREE from "three";
import spline from "./spline.js";
import { EffectComposer } from "jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "jsm/postprocessing/UnrealBloomPass.js";
import getStarfield from "./getStarField.js";
import { Text } from 'https://cdn.jsdelivr.net/npm/troika-three-text@0.52.3/+esm'

export class WormHole {
    constructor() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.4);
        this.camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
        this.camera.position.z = 5;
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(w, h);
        // this.renderer.setPixelRatio(1);

        this.tubeGeo = new THREE.TubeGeometry(spline, 1024, 0.65, 128, true);

        const edges = new THREE.EdgesGeometry(this.tubeGeo, 0.1);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2.0 });
        const tubeLines = new THREE.LineSegments(edges, lineMat);
        this.scene.add(tubeLines);

        this.speed = 1.0;
        this.isPaused = false;
        this.isReversed = false;
        this.timePaused = 0;
        this.animationTime = 0;

        // post-processing
        const renderScene = new RenderPass(this.scene, this.camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 1.5, 0.4, 100);
        bloomPass.threshold = 0.042;
        bloomPass.strength = 1.0;
        bloomPass.radius = 0;
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);
        // this.composer.addPass(bloomPass);

        const stars = getStarfield();
        this.scene.add(stars);
        this.texts = [
            "anger",
            "guilt",
            "pain",
            "betrayl",
            "lies"
        ]
        this.addTextAlongCurve();

        window.addEventListener('resize', () => this.handleWindowResize());
        this.animate();
    }

    addTextAlongCurve() {
        for (let i = 0; i < this.texts.length; i++) {
            const u = i / this.texts.length;
            const pos = this.tubeGeo.parameters.path.getPointAt(u);
            const text = new Text();
            text.text = this.texts[i];
            text.fontSize = 0.3;
            text.position.set(pos.x, pos.y, pos.z);
            text.anchorX = "center";
            text.anchorY = "middle";
            text.color = "white";
            text.sync();
            this.scene.add(text);
        }
    }

    getCanvas() {
        if (!this.renderer.domElement) {
            throw new Error("Renderer not initialized yet! Please Wait before calling it");
        }
        return this.renderer.domElement;
    }

    setSpeed(speed) {
        this.speed = speed;
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
        this.timePaused = Date.now() - this.animationTime;
    }

    reverse() {
        this.isReversed = !this.isReversed;
        this.speed = this.isReversed ? -Math.abs(this.speed) : Math.abs(this.speed);
    }

    updateCamera(t) {
        if (this.isPaused) {
            return;
        }

        this.animationTime = Date.now();
        const time = (t + this.timePaused) * Math.abs(this.speed) * 0.1;
        const looptime = 10 * 1000;
        const direction = this.isReversed ? -1 : 1;
        let p = ((time % looptime) / looptime) * direction;
        p = (p + 1) % 1;
        const pos = this.tubeGeo.parameters.path.getPointAt(p);
        const lookAt = this.tubeGeo.parameters.path.getPointAt((p + 0.03) % 1);
        this.camera.position.copy(pos);
        this.camera.lookAt(lookAt);
    }

    animate(t = 0) {
        requestAnimationFrame(this.animate.bind(this));
        this.updateCamera(t);
        // this.renderer.render(this.scene, this.camera);
        this.composer.render(this.scene, this.camera);
    }

    handleWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
