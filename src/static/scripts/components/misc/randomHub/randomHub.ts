import { getRandomSubreddit, getRandomSubredditPostUrl } from "../../../api/photonApi.js";
import { pushLinkToHistoryComb } from "../../../historyState/historyStateManager.js";
import Ph_Toast, { Level } from "../toast/toast.js";

enum RandomTarget {
	Random, RandNsfw, RandomPost
}

export default class Ph_RandomHub extends HTMLElement {
	randomTarget: RandomTarget;
	subreddit: string;
	otherParams: string = "";

	/** one of: r/random, r/randnsfw, r/{sub}/random */
	constructor(url: string) {
		super();

		this.classList.add("randomHub");

		const actionButton = document.createElement("button");
		actionButton.className = "randomButton";
		actionButton.addEventListener("click", this.onButtonClick.bind(this));
		const buttonText = document.createElement("div");
		actionButton.appendChild(buttonText);
		this.appendChild(actionButton);

		if (/^\/r\/random([/#?].*)?$/.test(url)) {
			this.randomTarget = RandomTarget.Random;
			buttonText.innerText = "Random Subreddit";
			this.otherParams = url.match(/\/r\/[^\/]+([/?#].*)?/)[1] || "";
		}
		else if (/^\/r\/randnsfw([/#?].*)?$/.test(url)) {
			this.randomTarget = RandomTarget.RandNsfw;
			buttonText.innerText = "Random NSFW Subreddit";
			this.otherParams = url.match(/\/r\/[^\/]+([/?#].*)?/)[1] || "";
		}
		else if (/^\/r\/[^/?#]+\/random([/#?].*)?$/.test(url)) {
			this.randomTarget = RandomTarget.RandomPost;
			this.subreddit = url.match(/(?<=\/r\/)[^/?#]+/)[0];
			buttonText.innerText = `Random Post on r/${this.subreddit}`;
			this.otherParams = url.match(/\/r\/[^\/]+\/random([/?#].*)?/)[1] || "";
		}
		else
			throw "invalid url scheme";
	}

	onButtonClick() {
		switch (this.randomTarget) {
			case RandomTarget.Random:
				this.goToRandomSubreddit();
				break;
			case RandomTarget.RandNsfw:
				this.goToRandomSubreddit(true);
				break;
			case RandomTarget.RandomPost:
				this.goToRandomSubredditPost(this.subreddit);
				break;
		}
	}

	async goToRandomSubreddit(isNsfw = false) {
		const randomSub = await getRandomSubreddit(isNsfw);
		if (randomSub)
			pushLinkToHistoryComb(`/r/${randomSub}${this.otherParams}`);
		else
			new Ph_Toast(Level.error, "Couldn't get random subreddit")
	}

	async goToRandomSubredditPost(subreddit: string) {
		const randomPost = await getRandomSubredditPostUrl(this.subreddit);
		if (randomPost)
			pushLinkToHistoryComb(randomPost + this.otherParams);
		else
			new Ph_Toast(Level.error, "Couldn't get random subreddit")
	}
}

customElements.define("ph-random-hub", Ph_RandomHub);