import { getImgurAlbumContents, getImgurContent, ImgurContent, ImgurContentType } from "../../api/imgurApi.js";
import { RedditApiType } from "../../types/misc.js";
import { nonDraggableImage } from "../../utils/htmlStatics.js";
import { linksToSpa } from "../../utils/htmlStuff.js";
import Ph_ControlsBar from "../misc/controlsBar/controlsBar.js";
import Ph_DropDown, { DirectionX, DirectionY } from "../misc/dropDown/dropDown.js";
import Ph_SwitchingImage from "../misc/switchableImage/switchableImage.js";
import Ph_PhotonBaseElement from "../photon/photonBaseElement/photonBaseElement.js";
import Ph_DraggableWrapper from "../post/postBody/draggableWrapper/draggableWrapper.js";
import Ph_ImageViewer from "./imageViewer/imageViewer.js";
import { MediaElement } from "./mediaElement.js";
import Ph_SimpleVideo from "./videoPlayer/simpleVideo/simpleVideo.js";
import Ph_VideoPlayer from "./videoPlayer/videoPlayer.js";

export default class Ph_MediaViewer extends Ph_PhotonBaseElement {
	controls: Ph_ControlsBar;
	draggableWrapper: Ph_DraggableWrapper;
	mediaElements: MediaElement[];
	currentIndex: number;
	isInFullscreenState: boolean = false;
	fullscreenImage: Ph_SwitchingImage;
	settingsDropDown: Ph_DropDown;
	elementLink: HTMLAnchorElement;
	elementCaption: HTMLDivElement;
	currentIndexDisplay: HTMLDivElement;

	static fromPostData_Image(postData: RedditApiType): Ph_MediaViewer {
		if (postData.data["preview"]) {
			const previews: any[] = postData.data["preview"]["images"][0]["resolutions"];
			return new Ph_MediaViewer([new Ph_ImageViewer({
				originalUrl: postData.data["url"],
				previewUrl: previews[previews.length - 1]["url"]
			})]);
		}
		else {
			return new Ph_MediaViewer([new Ph_ImageViewer({
				originalUrl: postData.data["url"],
			})]);
		}
	}

	static fromPostData_Video(postData: RedditApiType): Ph_MediaViewer {
		const mediaViewer = new Ph_MediaViewer();
		const video = Ph_VideoPlayer.fromPostData(postData)
		video.then(readyVideo => mediaViewer.init([ readyVideo]));
		return mediaViewer;
	}

	static fromImgurUrl(url: string): Ph_MediaViewer {
		const mediaViewer = new Ph_MediaViewer();
		if (/imgur\.com\/(a|album|gallery)\/[^/]+\/?$/.test(url)) {
			getImgurAlbumContents(url).then((contents: ImgurContent[]) => {
				mediaViewer.init(contents.map(imgurElement => {
					if (imgurElement.type === ImgurContentType.image)
						return  Ph_MediaViewer.makeImgurImage(imgurElement, url);
					else
						return  Ph_MediaViewer.makeImgurVideo(imgurElement, url);
				}));
			});
		}
		else {
			getImgurContent(url).then(content => {
				if (content.type === ImgurContentType.image) {
					const img = Ph_MediaViewer.makeImgurImage(content, url);
					mediaViewer.init([img]);
				}
				else {
					const video = Ph_MediaViewer.makeImgurVideo(content, url);
					mediaViewer.init([video]);
				}
			});
		}
		return mediaViewer;
	}

	private static makeImgurImage(data: ImgurContent, url: string) {
		return new Ph_ImageViewer({
			originalUrl: data.link,
			caption: data.caption,
			displayUrl: url
		});
	}

	private static makeImgurVideo(data: ImgurContent, url: string) {
		const videoPlayer = new Ph_VideoPlayer(url);
		videoPlayer.caption = data.caption;
		videoPlayer.init(new Ph_SimpleVideo([{
			src: data.link,
			type: "video/mp4"
		}]));
		return videoPlayer;
	}

	constructor(initElements?: MediaElement[]) {
		super();

		this.classList.add("mediaViewer");

		this.draggableWrapper = new Ph_DraggableWrapper();
		this.appendChild(this.draggableWrapper);

		this.controls = new Ph_ControlsBar(true);
		this.controls.addShowHideListeners(this.draggableWrapper);
		this.appendChild(this.controls);

		if (initElements)
			this.init(initElements);
	}

	init(initElements: MediaElement[]) {
		this.mediaElements = initElements;

		const controlSlots: HTMLElement[] = [];

		// prev/next + i
		if (initElements.length > 1) {
			const prevBtn = Ph_ControlsBar.makeImageButton("/img/playBack.svg");
			prevBtn.addEventListener("click", this.previousGalleryElement.bind(this));
			controlSlots.push(prevBtn);
			const nextBtn = Ph_ControlsBar.makeImageButton("/img/playNext.svg");
			nextBtn.addEventListener("click", this.nextGalleryElement.bind(this));
			controlSlots.push(nextBtn);
			controlSlots.push(this.controls.firstLeftItemsSlot);
			this.currentIndexDisplay = document.createElement("div");
			this.currentIndexDisplay.className = "textOnly";
			controlSlots.push(this.currentIndexDisplay);
		}
		else
			controlSlots.push(this.controls.firstLeftItemsSlot);
		controlSlots.push(this.controls.leftItemsSlot);
		// spacer
		const spacer = Ph_ControlsBar.makeSpacer();
		controlSlots.push(spacer);
		//caption
		this.elementCaption = document.createElement("div");
		this.elementCaption.className = "textOnly";
		controlSlots.push(this.elementCaption);
		// link
		this.elementLink = document.createElement("a");
		this.elementLink.className = "textOnly";
		this.elementLink.href = "";
		this.elementLink.setAttribute("excludeLinkFromSpa", "");
		controlSlots.push(this.elementLink);
		controlSlots.push(this.controls.rightItemsSlot);
		// reset view
		const resetViewBtn = Ph_ControlsBar.makeImageButton("/img/reset.svg");
		resetViewBtn.classList.add("resetView");
		resetViewBtn.addEventListener("click", () => this.draggableWrapper.reset());
		controlSlots.push(resetViewBtn);
		// settings dropdown
		const settingsImg = document.createElement("img");
		settingsImg.src = "/img/settings2.svg";
		nonDraggableImage(settingsImg)
		settingsImg.alt = "settings";
		this.settingsDropDown = new Ph_DropDown(
			[
				{ displayHTML: "filters" }
			],
			settingsImg, DirectionX.right, DirectionY.top, false
		)
		controlSlots.push(this.settingsDropDown);
		// fullscreen
		const { b: fsBtn, img: fsImg } = Ph_ControlsBar.makeSwitchingImageBtn(new Ph_SwitchingImage([
			{ src: "/img/fullscreen.svg", key: "fullscreen" },
			{ src: "/img/minimize.svg", key: "minimize" },
		]));
		this.fullscreenImage = fsImg;
		fsBtn.addEventListener("click", this.toggleFullscreen.bind(this));
		controlSlots.push(fsBtn);

		this.controls.setupSlots(controlSlots);

		this.addEventListener("fullscreenchange", this.onFullscreenChange.bind(this));
		this.draggableWrapper.addEventListener("dblclick", this.toggleFullscreen.bind(this));

		linksToSpa(this);
		this.currentIndex = 0;
		this.displayCurrentElement();
	}

	displayCurrentElement() {
		const newMedia = this.mediaElements[this.currentIndex];
		// replace element
		this.draggableWrapper.children[0]?.remove();
		this.draggableWrapper.appendChild(newMedia.element);
		// gallery index
		if (this.mediaElements.length > 1)
			this.currentIndexDisplay.innerText = `${this.currentIndex + 1}/${this.mediaElements.length}`;
		// capation
		this.elementCaption.innerText = newMedia.caption || "";
		this.elementCaption.title = newMedia.caption || "";
		// link
		this.elementLink.href = newMedia.url;
		this.elementLink.innerText = newMedia.url.match(/[\w-_]+\.[\w-_]+(?=[/?#])+/)[0];
		// controls slots
		this.controls.updateSlotsWIth(newMedia.controls);
		// fs event
		if (document.fullscreenElement)
			newMedia.element.dispatchEvent(new Event("ph-entered-fullscreen"));
	}

	nextGalleryElement() {
		this.currentIndex = (this.currentIndex + 1) % this.mediaElements.length;
		this.displayCurrentElement();
	}

	previousGalleryElement() {
		this.currentIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.mediaElements.length - 1;
		this.displayCurrentElement();
	}

	toggleFullscreen() {
		if (document.fullscreenElement)
			document.exitFullscreen();
		else
			this.requestFullscreen();
	}

	onFullscreenChange() {
		if (document.fullscreenElement)
			this.onEnterFullscreen();
		else
			this.onExitFullscreen();
	}

	onEnterFullscreen() {
		this.isInFullscreenState = true;
		this.mediaElements[this.currentIndex].element.dispatchEvent(new Event("ph-entered-fullscreen"));
		this.draggableWrapper.activate();
		this.fullscreenImage.showImage("minimize");
		this.classList.add("isInFullscreen");
	}

	onExitFullscreen() {
		this.isInFullscreenState = false;
		this.draggableWrapper.deactivate();
		this.draggableWrapper.reset();
		this.fullscreenImage.showImage("fullscreen")
		this.classList.remove("isInFullscreen");
	}

	cleanup() {
		super.cleanup();
		this.mediaElements
			.filter(elem => elem.element instanceof Ph_PhotonBaseElement)
			.forEach(elem => (elem.element as Ph_PhotonBaseElement).cleanup());
	}
}

customElements.define("ph-media-viewer", Ph_MediaViewer);
