import * as THREE from "three";
import spline from "./spline.js";

export class WormHole {
    constructor() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.3);
        this.camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
        this.camera.position.z = 5;
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(w, h);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        // create a tube geometry from the spline
        this.tubeGeo = new THREE.TubeGeometry(spline, 222, 0.65, 16, true);

        // create edges geometry from the spline
        const edges = new THREE.EdgesGeometry(this.tubeGeo, 0.2);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 4 });
        const tubeLines = new THREE.LineSegments(edges, lineMat);
        this.scene.add(tubeLines);

        this.speed = 1.0;
        this.isPaused = false;  // Track if the animation is paused
        this.isReversed = false;  // Track if the animation is reversed
        this.timePaused = 0;  // Store the time when paused
        this.animationTime = 0;  // Store the current time of the animation

        window.addEventListener('resize', this.handleWindowResize.bind(this), false);
        this.animate();
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

    // Method to pause the animation
    pause() {
        this.isPaused = true;
    }

    // Method to resume the animation
    resume() {
        this.isPaused = false;
        this.timePaused = Date.now() - this.animationTime;  // Set the time when the animation was paused
    }

    // Method to reverse the animation
    reverse() {
        this.isReversed = !this.isReversed;
        this.speed = this.isReversed ? -Math.abs(this.speed) : Math.abs(this.speed);
    }

    updateCamera(t) {
        if (this.isPaused) {
            return;  // If paused, do not update camera
        }

        // Update the animation time
        this.animationTime = Date.now();
        const time = (t + this.timePaused) * Math.abs(this.speed) * 0.1;
        const looptime = 10 * 1000;
        const direction = this.isReversed ? -1 : 1;  // Use reversed direction if necessary
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
        this.renderer.render(this.scene, this.camera);
    }

    handleWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
