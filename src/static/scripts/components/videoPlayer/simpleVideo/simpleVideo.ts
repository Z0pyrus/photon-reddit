import { clamp } from "../../../utils/conv.js";
import Ph_VideoWrapper from "../videoWrapper.js";

export default class Ph_SimpleVideo extends Ph_VideoWrapper {
	video: HTMLVideoElement;
	lastNon0Volume: number;
	noAudioProgressCallback: () => void;

	constructor(sourcesArray?: { src?: string, type: string }[], sourcesHtml?: string[]) {
		super();

		this.video = document.createElement("video");
		this.video.setAttribute("loop", "");
		this.appendChild(this.video);
		if (sourcesArray) {
			for (const source of sourcesArray)
				this.video.insertAdjacentHTML("beforeend", `<source src="${source.src}" type="${source.type}">`);
		}
		else if (sourcesHtml) {
			for (const source of sourcesHtml)
				this.video.insertAdjacentHTML("beforeend", source);
		}
		else
			throw "Invalid video sources"

		this.lastNon0Volume = this.video.volume;
		this.video.muted = true;

		// this mess is needed in order to know if the video has audio
		this.video.addEventListener("timeupdate", this.noAudioProgressCallback = () => {
			if (this.video.currentTime > 0) {
				this.video.removeEventListener("timeupdate", this.noAudioProgressCallback);
				this.noAudioProgressCallback = undefined;
				if (this.video["webkitAudioDecodedByteCount"] === 0 || this.video["mozHasAudio"] === false || this.video["audioTracks"] && this.video["audioTracks"]["length"] === 0)
					this.dispatchEvent(new Event("ph-noaudio"));
			}
		});

		this.video.addEventListener("play", () => this.dispatchEvent( new Event("ph-play")));
		this.video.addEventListener("pause", () => this.dispatchEvent( new Event("ph-pause")));
		this.video.addEventListener("volumechange", () => this.dispatchEvent(
			new CustomEvent("ph-volumechange", { detail: this.video.muted ? 0 : this.video.volume })));
		this.video.addEventListener("seeked", () => this.dispatchEvent(new Event("ph-seek")));
		this.video.addEventListener("seeking", () => this.dispatchEvent(new Event("ph-seek")));
	}

	play(): void {
		this.video.play();
	}

	pause(): void {
		this.video.pause();
	}

	togglePlay(): boolean {
		if (this.video.paused)
			this.video.play();
		else
			this.video.pause();
		
		return !this.video.paused;
	}

	seekTo(time: number): void {
		this.video.currentTime = time;
	}

	getCurrentTime(): number {
		return this.video.currentTime;
	}

	getMaxTime(): number {
		return this.video.duration;
	}

	toggleMute(): boolean {
		return this.video.muted = !this.video.muted;
	}

	setVolume(vol: number): void {
		this.video.volume = clamp(vol, 0, 1);
		if (this.video.volume > 0)
			this.lastNon0Volume = this.video.volume;
		if (vol > 0 && this.video.muted)
			this.video.muted = false;
	}

	getVolume(): number {
		return this.video.volume;
	}

	setPlaybackSpeed(speed: number) {
		this.video.playbackRate = speed;
	}

	getDimensions(): number[] {
		return [ this.video.videoWidth, this.video.videoHeight ];
	}
}

customElements.define("ph-video", Ph_SimpleVideo);