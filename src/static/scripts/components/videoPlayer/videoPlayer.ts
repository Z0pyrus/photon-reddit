import { secondsToVideoTime } from "../../utils/utils.js";
import { RedditApiType } from "../../utils/types.js";
import Ph_DropDown, {DirectionX, DirectionY} from "../misc/dropDown/dropDown.js";
import Ph_DropDownArea from "../misc/dropDown/dropDownArea/dropDownArea.js";
import Ph_DropDownEntry from "../misc/dropDown/dropDownEntry/dropDownEntry.js";
import Ph_ProgressBar from "../misc/progressBar/progressBar.js";
import Ph_SwitchingImage from "../misc/switchableImage/switchableImage.js";
import Ph_DraggableWrapper from "../post/postBody/draggableWrapper/draggableWrapper.js";

import Ph_GifVideo from "./gifVideo/gifVideo.js";
import Ph_PlayImage from "./icons/playImage.js";
import Ph_SimpleVideo from "./simpleVideo/simpleVideo.js";
import Ph_VideoAudio from "./videoAudio/videoAudio.js";
import Ph_VideoWrapper from "./videoWrapper.js";

export default class Ph_VideoPlayer extends HTMLElement {
	postData: RedditApiType;
	video: Ph_VideoWrapper;
	overlayIcon: Ph_SwitchingImage;
	hideTimeout = null;
	url: string;
	videoProgressInterval = null;
	controlsDropDown: Ph_DropDown;
	draggableWrapper: Ph_DraggableWrapper;
	resetViewBtn: HTMLButtonElement;

	constructor(postData: RedditApiType) {
		super();

		this.postData = postData;
		this.url = postData.data["url"];
		this.classList.add("videoPlayer");
		this.setAttribute("tabindex", "0");

		this.overlayIcon = new Ph_SwitchingImage([
			{ src: "/img/loading.svg", key: "loading" },
			{ src: "/img/playVideo.svg", key: "ready" },
			{ src: "", key: "none" },
		]);
		this.overlayIcon.classList.add("initialIcon");
		this.appendChild(this.overlayIcon);

		switch (this.url.match(/^https?:\/\/w?w?w?\.?([\w\.]+)/)[1]) {
			case "imgur.com":
			case "m.imgur.com":
			case "i.imgur.com":
				const typelessUrl = this.url.match(/^https?:\/\/([im])?\.?imgur\.com\/\w+/)[0];
				this.video = new Ph_SimpleVideo([
					{ src: typelessUrl + ".mp4", type: "video/mp4" },
				]);
				break;
			case "gfycat.com":
				const capitalizedPath = postData.data["media"]["oembed"]["thumbnail_url"].match(/^https?:\/\/thumbs\.gfycat\.com\/(\w+)/)[1];
				this.video = new Ph_SimpleVideo([
					{ src: `https://thumbs.gfycat.com/${capitalizedPath}-mobile.mp4`, type: "video/mp4" },
					{ src: `https://giant.gfycat.com/${capitalizedPath}.webm`, type: "video/webm" },
					{ src: `https://giant.gfycat.com/${capitalizedPath}.mp4`, type: "video/mp4" },
					{ src: `https://thumbs.gfycat.com/${capitalizedPath}-mobile.mp4`, type: "video/mp4" },
				]);
				break;
			case "v.redd.it":
				// wtf is this inconsistency v.redd.it ??????!
				this.video = new Ph_VideoAudio([
					{ src: postData.data["url"] + "/DASH_1080.mp4", type: "video/mp4" },
					{ src: postData.data["url"] + "/DASH_1080", type: "video/mp4" },
					{ src: postData.data["url"] + "/DASH_720.mp4", type: "video/mp4" },
					{ src: postData.data["url"] + "/DASH_720", type: "video/mp4" },
					{ src: postData.data["url"] + "/DASH_480.mp4", type: "video/mp4" },
					{ src: postData.data["url"] + "/DASH_480", type: "video/mp4" },
					{ src: postData.data["url"] + "/DASH_360.mp4", type: "video/mp4" },
					{ src: postData.data["url"] + "/DASH_360", type: "video/mp4" },
					{ src: postData.data["url"] + "/DASH_240.mp4", type: "video/mp4" },
					{ src: postData.data["url"] + "/DASH_240", type: "video/mp4" },
					{ src: postData.data["url"] + "/DASH_96.mp4", type: "video/mp4" },
					{ src: postData.data["url"] + "/DASH_96", type: "video/mp4" },
					{ src: postData.data["url"] + "/DASH_4_8_M", type: "video/mp4" },
					{ src: postData.data["url"] + "/DASH_2_4_M", type: "video/mp4" },
					{ src: postData.data["url"] + "/DASH_1_2_M", type: "video/mp4" },
					{ src: postData.data["url"] + "/DASH_600_K", type: "video/mp4" },
				], [
					{ src: postData.data["url"] + "/DASH_audio.mp4", type: "video/mp4" },
					{ src: postData.data["url"] + "/DASH_audio", type: "video/mp4" },
					{ src: postData.data["url"] + "/audio.mp4", type: "video/mp4" },
					{ src: postData.data["url"] + "/audio", type: "video/mp4" },
				]);
				break;
			case "clips.twitch.tv":
				const twitchUrl = postData.data["media"]["oembed"]["thumbnail_url"].match(/(.*)-social-preview.jpg$/)[1];
				this. video = new Ph_SimpleVideo([{ src: twitchUrl + ".mp4", type: "video/mp4" }]);
				break;
			case "redgifs.com":
				const iframeUrl = this.url.replace(/\/watch\//, "/ifr/");
				fetch(`/getIframeSrc?url=${encodeURIComponent(iframeUrl)}`).then(res => res.json().then(src => {
					this.video = new Ph_SimpleVideo(null, src["src"]);
					this.makeControls();
				}));
				break;
			default:
				if (/\.gif$/.test(this.url)) {
					this.video = new Ph_GifVideo(this.url);
					break;
				}
				else if (/\.mp4$/.test(this.url)) {
					this.video = new Ph_SimpleVideo([{ src: this.url, type: "video/mp4" }]);
					break;
				}
				this.innerText = `Unknown video provider for ${postData.data["url"]}`;
				break;
		}

		if (this.video)
			this.makeControls();
	}

	makeControls() {
		window.addEventListener("viewChange", () => this.video.pause());

		this.draggableWrapper = new Ph_DraggableWrapper();
		this.video.classList.add("draggable");
		this.draggableWrapper.appendChild(this.video);
		this.appendChild(this.draggableWrapper);

		const controls = document.createElement("div");
		this.appendChild(controls);
		controls.className = "controls";
		this.classList.add("controlsVisible");

		this.video.addEventListener("mouseenter", this.showControls.bind(this));
		this.video.addEventListener("mousemove", this.restartHideTimeout.bind(this));
		controls.addEventListener("mouseenter", this.clearHideTimeout.bind(this))
		controls.addEventListener("mouseleave", e => this.video.contains(e.relatedTarget as HTMLElement) || this.restartHideTimeout());
		this.video.addEventListener("click", () => this.video.togglePlay());
		this.video.addEventListener("dblclick", () => this.toggleFullscreen());
		this.addEventListener("keydown", e => {
			let actionExecuted = false;
			switch (e.code) {
				case "Space":
				case "KeyP":
				case "KeyK":
					this.video.togglePlay();
					actionExecuted = true;
					break;
				case "ArrowLeft":
				case "KeyJ":
					this.video.seekTo(this.video.getCurrentTime() - 5);
					actionExecuted = true;
					break;
				case "ArrowRight":
				case "KeyL":
					this.video.seekTo(this.video.getCurrentTime() + 5);
					actionExecuted = true;
					break;
				case "ArrowUp":
					this.video.setVolume(this.video.getVolume() + .1);
					actionExecuted = true;
					break;
				case "ArrowDown":
					this.video.setVolume(this.video.getVolume() - .1);
					actionExecuted = true;
					break;
				case "KeyF":
					this.toggleFullscreen();
					actionExecuted = true;
					break;
				case "KeyM":
					this.video.toggleMute();
					actionExecuted = true;
					break;
				case "KeyI":
					this.popoutVideo();
					actionExecuted = true;
					break;
			}
			if (actionExecuted) {
				e.preventDefault();
				this.restartHideTimeout();
			}
		});
		this.video.addEventListener("ph-ready", () => this.overlayIcon.activate("ready"));
		this.video.addEventListener("ph-buffering", () => this.overlayIcon.activate("loading"));
		this.video.addEventListener("ph-playing", () => this.overlayIcon.activate("none"));

		// play, pause, progress bar
		const playButton = new Ph_PlayImage();
		controls.appendChild(playButton);
		playButton.addEventListener("click", () => this.video.togglePlay());
		this.video.addEventListener("ph-play", () => {
			playButton.toPause();
			this.videoProgressInterval = setInterval(() => {
				progressBar.setProgress(this.video.getCurrentTime() / this.video.getMaxTime());
				timeText.innerText = `${secondsToVideoTime(this.video.getCurrentTime())} / ${secondsToVideoTime(this.video.getMaxTime())}`;
			}, 100);
		});
		this.video.addEventListener("ph-seek", () => progressBar.setProgress(this.video.getCurrentTime() / this.video.getMaxTime()));
		this.video.addEventListener("ph-pause", () => {
			playButton.toPlay();
			if (this.videoProgressInterval !== null) {
				clearTimeout(this.videoProgressInterval)
				this.videoProgressInterval = null;
			}
		});

		// time text
		const timeText = document.createElement("div");
		controls.appendChild(timeText);
		timeText.innerText = "00:00 / 00:00";

		// volume
		const volumeWrapper = document.createElement("div");
		volumeWrapper.className = "volumeWrapper";
		controls.appendChild(volumeWrapper);
		const muteButton = this.makeImgBtn(new Ph_SwitchingImage([
			{ src: "/img/mute.svg", key: "mute" },
			{ src: "/img/audio.svg", key: "audio" },
		]), volumeWrapper);
		muteButton.parentElement.addEventListener("click", () => this.video.toggleMute());
		const volumeSlider = new Ph_ProgressBar(true, 20);
		volumeSlider.addEventListener("ph-drag", (e: CustomEvent) => this.video.setVolume(e.detail));
		volumeWrapper.appendChild(volumeSlider);
		this.video.addEventListener("ph-volumechange",
			(e: CustomEvent) => {
				muteButton.activate(e.detail === 0 ? "mute" : "audio");
				volumeSlider.setProgress(e.detail);
			}
		)
		volumeWrapper.addEventListener("wheel", e => {
			e.preventDefault();
			this.video.setVolume(this.video.getVolume() + (-e.deltaY || e.deltaX) / 3000)
		}, { passive: false });
		this.video.addEventListener("ph-noaudio", () => volumeWrapper.classList.add("remove"));

		// left right divider
		const divider = document.createElement("div");
		divider.className = "mla";
		controls.appendChild(divider);

		// video src
		const srcText = document.createElement("div");
		controls.appendChild(srcText);
		srcText.innerHTML = `<a href="${this.url}" target="_blank">${this.url.match(/([\w.\.]+)\//)[1]}</a>`;

		// reset view
		this.resetViewBtn = document.createElement("button");
		this.resetViewBtn.innerHTML = `<img src="/img/reset.svg" draggable="false" class="padded">`;
		this.resetViewBtn.classList.add("hide");
		this.resetViewBtn.addEventListener("click", () => {
			this.draggableWrapper.setZoom(1);
			this.draggableWrapper.setMoveXY(0, 0);
		})
		controls.appendChild(this.resetViewBtn);

		// settings
		this.controlsDropDown = new Ph_DropDown([
			{ displayHTML: "Speed", nestedEntries: [
					{ displayHTML: "0.10x", value: 0.10, onSelectCallback: this.setVideoSpeed.bind(this) },
					{ displayHTML: "0.25x", value: 0.25, onSelectCallback: this.setVideoSpeed.bind(this) },
					{ displayHTML: "0.50x", value: 0.50, onSelectCallback: this.setVideoSpeed.bind(this) },
					{ displayHTML: "1.00x", value: 1.00, onSelectCallback: this.setVideoSpeed.bind(this) },
					{ displayHTML: "2.00x", value: 2.00, onSelectCallback: this.setVideoSpeed.bind(this) },
					{ displayHTML: "4.00x", value: 4.00, onSelectCallback: this.setVideoSpeed.bind(this) },
					{ displayHTML: "8.00x", value: 8.00, onSelectCallback: this.setVideoSpeed.bind(this) },
					{ displayHTML: "16.00x", value: 16.00, onSelectCallback: this.setVideoSpeed.bind(this) },
				] },
			{ displayHTML: "Popout", onSelectCallback: this.popoutVideo.bind(this) },
		], `<img src="/img/settings2.svg" draggable="false">`, DirectionX.right, DirectionY.top, false);
		this.controlsDropDown.classList.add("settings");
		this.controlsDropDown.getElementsByClassName("dropDownButton")[0].classList.add("imgBtn");
		controls.appendChild(this.controlsDropDown);

		// fullscreen
		const fullscreenButton = this.makeImgBtn(new Ph_SwitchingImage([
			{ src: "/img/fullscreen.svg", key: "fullscreen" },
			{ src: "/img/minimize.svg", key: "minimize" },
		]), controls);
		fullscreenButton.parentElement.addEventListener("click", () => this.toggleFullscreen())
		this.addEventListener("fullscreenchange",
			() => fullscreenButton.activate(document.fullscreenElement ? "minimize" : "fullscreen")
		);

		// progress bar
		const progressBar = new Ph_ProgressBar(true);
		controls.appendChild(progressBar);
		progressBar.addEventListener("ph-drag", (e: CustomEvent) => {
			this.video.seekTo(e.detail * this.video.getMaxTime());
		});
		progressBar.addEventListener("wheel", e => {
			e.preventDefault();
			this.video.seekTo(this.video.getCurrentTime() + (-e.deltaY || e.deltaX) / 20);
		}, { passive: false });
	}

	makeImgBtn(img: Ph_SwitchingImage, appendTo: HTMLElement): Ph_SwitchingImage {
		const button = document.createElement("button");
		button.className = "imgBtn";
		button.appendChild(img);
		appendTo.appendChild(button);
		return img;
	}

	setVideoSpeed(valueChain: any[], source: Ph_DropDownEntry) {
		this.video.setPlaybackSpeed(valueChain[1]);
	}

	popoutVideo() {
		window.open(
			`/mediaViewer.html?url=${encodeURIComponent(this.postData.data["permalink"])}`,
			"_blank",
			`location=no,status=no,menubar=no,width=${this.video.getDimensions()[0]},height=${this.video.getDimensions()[1]}`
		);
	}

	showControls() {
		this.classList.add("controlsVisible");

		this.hideTimeout = setTimeout(() => this.hideControls(), 2000);
	}

	restartHideTimeout() {
		if (!this.classList.contains("controlsVisible")) {
			this.clearHideTimeout();
			this.showControls();
			return;
		}

		this.clearHideTimeout();

		this.hideTimeout = setTimeout(() => this.hideControls(), 2000);
	}

	clearHideTimeout() {
		if (this.hideTimeout !== null) {
			clearTimeout(this.hideTimeout);
			this.hideTimeout = null;
		}
	}

	hideControls() {
		this.classList.remove("controlsVisible");

		for (let area of this.controlsDropDown.getElementsByClassName("dropDownArea")) {
			(area as Ph_DropDownArea).closeMenu(true);
		}

		this.clearHideTimeout();
	}

	toggleFullscreen(): boolean {
		this.classList.toggle("fullscreen");
		if (document.fullscreenElement) {
			document.exitFullscreen();
			this.resetViewBtn.click();
			this.draggableWrapper.deactivate();
			this.resetViewBtn.classList.add("hide");
			return false;
		}
		else if (this.requestFullscreen) {
			this.requestFullscreen();
			this.draggableWrapper.activateWith(this.video);
			this.resetViewBtn.classList.remove("hide");
			return  true
		}
		throw "can't enter fullscreen";
	}
}

customElements.define("ph-video-player", Ph_VideoPlayer);
