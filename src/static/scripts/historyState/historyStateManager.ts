/**
 * This files extends the functionality of ViewStack
 */

import { redditApiRequest } from "../api/redditApi.js";
import Ph_UniversalFeed from "../components/feed/universalFeed/universalFeed.js";
import Ph_MessageCompose from "../components/message/messageCompose/messageCompose.js";
import Ph_RandomHub from "../components/misc/randomHub/randomHub.js";
import Ph_Toast, { Level } from "../components/misc/toast/toast.js";
import Ph_About from "../components/photon/about/about.js";
import Ph_PostCrossposts from "../components/post/postCrossposts/postCrossPosts.js";
import PostDoubleLink from "../components/post/postDoubleLink/postDoubleLink.js";
import Ph_SubmitPostForm from "../components/post/submit/submitPostForm.js";
import Ph_PostAndComments from "../components/postAndComments/postAndComments.js";
import Ph_CommentsViewStateLoader from "../components/viewState/commentsViewStateLoader/commentsViewStateLoader.js";
import { Ph_ViewState } from "../components/viewState/viewState.js";
import Ph_ViewStateLoader from "../components/viewState/viewStateLoader/viewStateLoader.js";
import Ph_Wiki from "../components/wiki/wiki.js";
import { $id } from "../utils/htmlStatics.js";
import { extractHash, splitPathQuery } from "../utils/utils.js";
import ViewsStack from "./viewsStack.js";

ViewsStack.setNextIsReplace();

window.addEventListener("popstate", (e: PopStateEvent) => {
	// don't change history state when going back & in fullscreen (the user probably just wanted to exit fullscreen)
	if (document.fullscreenElement) {
		document.exitFullscreen();
		if (e.state.index <= ViewsStack.getPosition()) {
			// works only when previous history state has same domain
			e.preventDefault();
			history.forward();
			return;
		}
	}
	if (!e.state)		// new page load || something weird
		return
	// forward
	if (e.state.index > ViewsStack.getPosition()) {
		for(let i = e.state.index - ViewsStack.getPosition(); i > 0; --i)
			ViewsStack.forward(true);
	}
	// back
	else if (e.state.index < ViewsStack.getPosition()) {
		for(let i = ViewsStack.getPosition() - e.state.index; i > 0; --i)
			ViewsStack.back();
	}
});

// TODO Make this an option
// window.onbeforeunload = () => {
// 	return "Are you sure you want to Exit?";
// };

/** Whether a new history state should be inserted before or after the current one */
export enum PushType {
	pushAfter, pushBefore
}

/** Use this function to redirect to a SPA link and the url could contain a query part */
export function pushLinkToHistoryComb(pathAndQuery: string, pushType: PushType = PushType.pushAfter, postHint?: PostDoubleLink): void {
	const [path, query] = splitPathQuery(pathAndQuery);
	pushLinkToHistorySep(path, query, pushType, postHint);
}

/** Use this function to redirect to a SPA link and the url doesn't contain a query part */
export async function pushLinkToHistorySep(path: string, query: string = "?", pushType: PushType = PushType.pushAfter, postHint?: PostDoubleLink): Promise<void> {
	// don't load new page if next history state has same url
	const nextState = ViewsStack.getNextState();
	if (nextState && nextState.state.url == (path + query)) {
		history.forward();
		return;
	}

	const historyState = ViewsStack.makeHistoryState(path, path + query);
	let stateLoader: Ph_ViewState;
	if (postHint)
		stateLoader = new Ph_CommentsViewStateLoader(historyState, postHint);
	else
		stateLoader = new Ph_ViewStateLoader(historyState);

	if (pushType === PushType.pushAfter)
		ViewsStack.pushAfter(stateLoader);
	else if (pushType === PushType.pushBefore)
		ViewsStack.pushBefore(stateLoader);


	// convert query string to key value string[][]
	const urlParams = new URLSearchParams(query);
	const params: string[][] = [];
	for (const param of urlParams.entries())
		params.push(param);

	// maybe handle special unusual paths instead
	if (handleSpecialPaths(path, params, stateLoader)) {
		goToHash();
		return;
	}

	// make request to reddit
	const requestData = await redditApiRequest(path, params, false);
	if (requestData["error"]) {
		stateLoader.error()
		new Ph_Toast(Level.error, "Error making request to reddit");
		throw `Error making request to reddit (${path}, ${JSON.stringify(params)})`;
	}

	if (postHint) {
		stateLoader.finishWith(requestData);
		ViewsStack.setCurrentStateTitle(`${postHint.post.postTitle} - Photon`);
	}
	// result is a posts comments or post crosspost list
	else if (requestData instanceof Array) {		// --> [0]: post [1]: comments/posts
		if (requestData[1]["data"]["children"][0]?.["kind"] === "t3")
			stateLoader.finishWith(new Ph_PostCrossposts(requestData));
		else
			stateLoader.finishWith(new Ph_PostAndComments(requestData));
		ViewsStack.setCurrentStateTitle(`${requestData[0]["data"]["children"][0]["data"]["title"]} - Photon`);
	}
	// result is something else
	else if (requestData["kind"]) {
		// result is some sort of generic feed
		if (requestData["kind"] === "Listing") {
			stateLoader.finishWith(new Ph_UniversalFeed(requestData, path + query));
			ViewsStack.setCurrentStateTitle(`${(path.length > 3) ? path.slice(1) : "Home"} - Photon`);
		}
		// result is a wiki page
		else if (requestData["kind"] === "wikipage") {
			stateLoader.finishWith(new Ph_Wiki(requestData));
			ViewsStack.setCurrentStateTitle(`${path.match(/r\/[^/?#]+/i)[0]} Wiki - Photon`);
		}
	}

	goToHash();
}

/** if url has a hash to an element, scroll it into view */
function goToHash() {
	const hash = extractHash(history.state.url);
	if (hash)
		$id(hash.slice(1)).scrollIntoView();
}

function handleSpecialPaths(path: string, query: string[][], stateLoader: Ph_ViewState): boolean {
	// /about
	if (/^\/about(#.*)?$/i.test(path)) {
		stateLoader.finishWith(new Ph_About());
		return true;
	}
	// /submit or /r/sub/submit
	else if (/^(\/r\/[^/]+)?\/submit/i.test(path)) {
		stateLoader.finishWith(new Ph_SubmitPostForm());
		return true;
	}
	// /r/random or /r/randnsfw or /r/sub/random
	else if (/^\/r\/((random|randnsfw)|([^/?#]+\/random))([/#?].*)?$/i.test(path)) {
		const url = path + (query.length ? "?" + (new URLSearchParams(query).toString()) : "");
		stateLoader.finishWith(new Ph_RandomHub(url));
		return true;
	}
	// /message/compose
	else if (/^\/message\/compose/i.test(path)) {
		const receiver = query.find(param => param[0] === "to")?.[0];
		stateLoader.finishWith(new Ph_MessageCompose(receiver));
		return true;
	}
	return false;
}
