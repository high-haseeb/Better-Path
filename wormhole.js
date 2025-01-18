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
        document.body.appendChild(this.renderer.domElement);

        // create a tube geometry from the spline
        const tubeGeo = new THREE.TubeGeometry(spline, 222, 0.65, 16, true);

        // create edges geometry from the spline
        const edges = new THREE.EdgesGeometry(tubeGeo, 0.2);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 4 });
        const tubeLines = new THREE.LineSegments(edges, lineMat);
        this.scene.add(tubeLines);

        window.addEventListener('resize', this.handleWindowResize.bind(this), false);
    }
    updateCamera(t) {
        const time = t * 0.1;
        const looptime = 10 * 1000;
        const p = (time % looptime) / looptime;
        const pos = tubeGeo.parameters.path.getPointAt(p);
        const lookAt = tubeGeo.parameters.path.getPointAt((p + 0.03) % 1);
        this.camera.position.copy(pos);
        this.camera.lookAt(lookAt);
    }

    animate(t = 0) {
        requestAnimationFrame(this.animate.bind(this));
        this.updatethis.camera(t);
        this.renderer.render(this.scene, this.camera);
    }
    handleWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
