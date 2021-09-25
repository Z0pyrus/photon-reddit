/**
 * For communication with reddit
 */

import { checkTokenRefresh } from "../auth/auth";
import { initiateLogin } from "../auth/loginHandler";
import Ph_Flair from "../components/misc/flair/flair";
import Ph_Toast, { Level } from "../components/misc/toast/toast";
import Users from "../components/multiUser/userManagement";
import {
	FlairApiData,
	RedditApiObj,
	RedditJsonApiResponse,
	RedditListingObj,
	RedditMultiObj,
	RedditPreferences,
	RedditSubredditObj,
	RedditUserObj
} from "../types/redditTypes";
import Votable, { FullName } from "../types/votable";
import { isObjectEmpty, splitPathQuery, throttle } from "../utils/utils";

/**
 * Use this to make requests to reddit
 *
 * @param pathAndQuery
 * @param params
 * @param requiresLogin
 * @param options
 */
export async function redditApiRequest(pathAndQuery, params: string[][] | any, requiresLogin: boolean, options: RequestInit = {}) {
	if (requiresLogin && !Users.current.d.auth.isLoggedIn) {
		new Ph_Toast(Level.error, "Not logged in! Do you want to log in with Reddit?", { onConfirm: () => initiateLogin(), groupId: "not logged in" });
		throw "This feature requires to be logged in";
	}

	return await oauth2Request(pathAndQuery, params, options);
}

/** Makes a request to reddit with an an access token */
async function oauth2Request(pathAndQuery, params: string[][] | any, options: RequestInit, attempt = 0) {
	pathAndQuery = fixUrl(pathAndQuery);
	const [path, query] = splitPathQuery(pathAndQuery);

	let fetchOptions: RequestInit = {
		...options,
		headers: new Headers({
			Authorization: getAuthHeader(),
		}),
	};
	let parameters: URLSearchParams;
	let useUrlParams = false;
	if (params instanceof Array) {
		parameters = new URLSearchParams(query);
		useUrlParams = true;
		for (const param of params) {
			parameters.append(param[0], param[1]);
		}
		parameters.append("raw_json", "1");
	}
	if (fetchOptions.method && fetchOptions.method.toUpperCase() !== "GET") {
		fetchOptions.body = parameters ?? params;
	}

	try {
		const response = await fetch(`https://oauth.reddit.com${ path }?${ useUrlParams ? parameters.toString() : "" }`, fetchOptions);
		const responseText = await response.text();
		rateLimitCheck(response.headers);
		return responseText ? JSON.parse(responseText) : {};
	} catch (e) {
		// maybe the token has expired, try to refresh it
		if (attempt < 1 && await checkTokenRefresh())
			return await oauth2Request(path, params, options, attempt + 1);
		else
			return { error: e }
	}
}

export function getAuthHeader(): string {
	return `Bearer ${ Users.current.d.auth.accessToken }`;
}

function fixUrl(url: string) {
	url = url.toLowerCase();
	url = url.replace(/^\/u\//, "/user/");													// /u/... --> /user/...
	url = url.replace(/(\/(u|user)\/[^/]+\/)posts\/?/, "$1submitted/")						// /user/.../posts --> /user/.../submitted
	url = url.replace(/#[^?]*/, "");														// ...#...?... --> ...?...
	url = url.replace(/(^\/\w+\/[^/]+)\/w(?=([#?\/]).*|$)/, "$1/wiki");					// /.../.../w --> /.../.../wiki
	url = url.replace(/(^\/r\/[^/]+\/wiki)\/?(?=([?|#].*)?$)/, "$1/index");				// /r/.../wiki --> /r/.../wiki/index
	url = url.replace(/(^\/\w+\/[^/]+\/wiki(?:[^#?]*)?)\/(?=([#?\/]).*|$)/, "$1");			// /.../.../wiki/.../ --> /.../.../wiki/... (with / causes redirect and removes params)
	url = url.replace(/^\/gallery(?=\/\w+)/, "/comments");									// /gallery/... --> /comments/...
	if (new RegExp(`^/(u|user)/${Users.current.name}/m/([^/]+)`, "i").test(url))					// private multireddits have CORS problems
		url = url.replace(/^\/user\/[^/]+\/m\//, "/me/m/")									// /user/thisUser/m/... --> /me/m/...
	return url;
}

function rateLimitCheck(headers: Headers) {
	const rlReqRemaining = parseInt(headers.get("x-ratelimit-remaining"));
	const rlTimeRemaining = parseInt(headers.get("x-ratelimit-reset"));
	if (rlReqRemaining < 50)
		rateLimitWarning(rlReqRemaining, rlTimeRemaining);
}

const rateLimitWarning = throttle(_rateLimitWarning, 15 * 1000);
function _rateLimitWarning(reqRemaining, timeRemaining) {
	new Ph_Toast(Level.warning, `Rate limit almost fully used (${reqRemaining} requests remaining for next ${timeRemaining}s)`);
}

export enum VoteDirection {
	up = "1",
	down = "-1",
	none = "0"
}

export function voteDirectionFromLikes(likes: boolean) {
	switch (likes) {
		case null:
			return VoteDirection.none;
		case true:
			return VoteDirection.up;
		case false:
			return VoteDirection.down;
		default:
			throw "Invalid likes value";
	}
}

export async function vote(votable: Votable): Promise<boolean> {
	try {
		const resp = await redditApiRequest("/api/vote", [
			["dir", votable.currentVoteDirection], 
			["id", votable.fullName]
		],
		true, { method: "POST" });

		if (resp["error"])
			console.error(resp["message"])
		return isObjectEmpty(resp);
	} catch (error) {
		console.error(error);
		return false	
	}
}

export async function save(votable: Votable): Promise<boolean> {
	try {
		const resp = await redditApiRequest(votable.isSaved ? "/api/save" : "/api/unsave", [
			["id", votable.fullName]
		],
		true, { method: "POST" });

		if (resp["error"])
			console.error(resp["message"])
		return isObjectEmpty(resp);
	} catch (error) {
		console.error(error);
		return false
	}
}

export async function comment(thing: FullName, text: string): Promise<RedditJsonApiResponse> {
	return await redditApiRequest("/api/comment", [
		["api_type", "json"],
		["text", text],
		["thing_id", thing.fullName]
	], true, { method: "POST" });
}

export async function redditInfo(fullName: string): Promise<RedditApiObj> {
	return (await redditApiRequest("/api/info", [["id", fullName]], false)).data.children[0];
}

export async function edit(votable: Votable, bodyMd: string) {
	return await redditApiRequest("/api/editusertext", [
		["api_type", "json"],
		["return_rtjson", "trie"],
		["text", bodyMd],
		["thing_id", votable.fullName],
	], true, { method: "POST" })
}

export async function deleteThing(votable: Votable) {
	return await redditApiRequest("/api/del", [["id", votable.fullName]], true, { method: "POST" });
}

export async function searchSubredditNames(query: string) {
	return await redditApiRequest("/api/search_reddit_names", [["query", query]], false);
}

export async function searchSubreddits(query: string, limit = 5): Promise<RedditListingObj<RedditSubredditObj>> {
	return await redditApiRequest("/subreddits/search", [["q", query], ["limit", limit.toString()]], false);
}

export async function searchUser(query: string, limit = 5): Promise<RedditListingObj<RedditUserObj>> {
	return await redditApiRequest("/users/search", [["q", query], ["limit", limit.toString()]], false);
}

export async function subscribe(subredditFullName: string, shouldSubscribe: boolean): Promise<boolean> {
	try {
		return isObjectEmpty(await redditApiRequest(
			"/api/subscribe",
			[
				["action", shouldSubscribe ? "sub" : "unsub"],
				["sr", subredditFullName]
			],
			true,
			{method: "POST"}
		));
	} catch (e) {
		console.error(e);
		return false;
	}
}

export async function loadMoreComments(children: string[], postFullName: string, sort: string, id: string): Promise<RedditJsonApiResponse> {
	return  await redditApiRequest("/api/morechildren", [
		["api_type", "json"],
		["children", children.join(",")],
		["link_id", postFullName],
		["sort", sort],
		["limit_children", "false"],
		["id", id]
	], false, {method: "POST"});
}

export async function getMultiInfo(multiPath: string): Promise<RedditMultiObj> {
	return await redditApiRequest(`/api/multi${multiPath}`, [["expand_srs", "1"]], false);
}

export async function getUserMultis(userName: string): Promise<RedditMultiObj[]> {
	return await redditApiRequest(`/api/multi/user/${userName}`, [], false);
}

export async function getMyMultis(): Promise<RedditMultiObj[]> {
	return await redditApiRequest("/api/multi/mine", [], true);
}

export async function addSubToMulti(multiPath: string, subName: string) {
	return await redditApiRequest(
		`/api/multi${multiPath}/r/${subName}`,
		[
			["model", JSON.stringify({ name: subName })]
		],
		true,
		{ method: "PUT" }
	);
}

export async function removeSubFromMulti(multiPath: string, subName: string) {
	return await redditApiRequest(
		`/api/multi${multiPath}/r/${subName}`,
		[],
		true,
		{ method: "DELETE" }
	);
}

export async function getSubInfo(subPath: string) {
	return await redditApiRequest(`${subPath}/about`, [], false)
}

export async function getSubRules(subPath: string) {
	return await redditApiRequest(`${subPath}/about/rules`, [], false)
}

export async function getSubModerators(subPath: string) {
	return await redditApiRequest(`${subPath}/about/moderators`, [], false)
}

export async function setMessageReadStatus(isRead: boolean, messageFullName: string) {
	return await redditApiRequest(
		isRead ? "/api/read_message" : "/api/unread_message",
		[["id", messageFullName]],
		true,
		{ method: "POST" }
	);
}

export async function readAllMessages() {
	return await redditApiRequest("/api/read_all_messages", [], true, { method: "POST" })
}

export async function getSubFlairs(subPath: string): Promise<FlairApiData[]> {
	let flairs = await redditApiRequest(`${subPath}/api/link_flair_v2`, [], true);
	if (flairs["error"] === 403)
		flairs = [];
	return flairs;
}

export async function getSubUserFlairs(subPath: string): Promise<FlairApiData[]> {
	let flairs = await redditApiRequest(`${subPath}/api/user_flair_v2`, [], true);
	if (flairs["error"] === 403)
		flairs = [];
	return flairs;
}

export async function editCommentOrPost(newText: string, thingFullName: string) {
	return await redditApiRequest(
		"/api/editusertext", [
			["api_type", "json"],
			["text", newText],
			["thing_id", thingFullName],
		],
		true,
		{ method: "POST" }
	);
}

export async function getMySubs(limit: number, after?: string): Promise<RedditListingObj<RedditSubredditObj>> {
	const params = [["limit", limit.toString()]];
	if (after)
		params.push(["after", after]);
	return await redditApiRequest("/subreddits/mine/subscriber", params, true);
}

export async function setPostNsfw(fullName: string, isNsfw: boolean): Promise<boolean> {
	const r = await redditApiRequest(
		isNsfw ? "/api/marknsfw" : "/api/unmarknsfw",
		[["id", fullName]],
		true,
		{ method: "POST" }
	)
	return !("error" in r) && isObjectEmpty(r);
}

export async function setPostSpoiler(fullName: string, isSpoiler: boolean): Promise<boolean> {
	const r = await redditApiRequest(
		isSpoiler ? "/api/spoiler" : "/api/unspoiler",
		[["id", fullName]],
		true,
		{ method: "POST" }
	)
	return !("error" in r) && isObjectEmpty(r);
}

export async function setPostSendReplies(fullName: string, sendReplies: boolean): Promise<boolean> {
	const r = await redditApiRequest(
		"/api/sendreplies",
		[["id", fullName], ["state", sendReplies.toString()]],
		true,
		{ method: "POST" }
	)
	return !("error" in r) && isObjectEmpty(r);
}

export async function setPostFlair(fullName: string, subredditName: string, flair: Ph_Flair) {
	const flairId = flair.data.id;
	const flairText = flair.hasTextChanged ? flair.data.text : null;
	const r = await redditApiRequest(
		`/r/${subredditName}/api/selectflair`,
		[["link", fullName], ["flair_template_id", flairId], flairText ? ["text", flairText] : ["", ""]],
		true,
		{ method: "POST" }
	)
	return !("error" in r) && r["success"];
}

export async function setUserFlair(subredditPath: string, flair: Ph_Flair) {
	const flairId = flair.data.id;
	const flairText = flair.hasTextChanged ? flair.data.text : null;
	const r = await redditApiRequest(
		subredditPath + "/api/selectflair",
		[["name", Users.current.name], ["flair_template_id", flairId], flairText ? ["text", flairText] : ["", ""]],
		true, { method: "POST" }
	);
	return !("error" in r) && r["success"];
}

export async function deleteUserFlair(subredditPath: string) {
	const r = await redditApiRequest(
		subredditPath + "/api/selectflair",
		[["name", Users.current.name], ["flair_template_id", ""]],
		true, { method: "POST" }
	);
	return !("error" in r) && r["success"];
}

export async function blockUser(fullname: string): Promise<boolean> {
	const response = await redditApiRequest(
		"/api/block",
		[["id", fullname]],
		true,
		{ method: "POST" }
	);

	return isObjectEmpty(response);
}

export async function deleteMessage(fullname: string) {
	const response = await redditApiRequest(
		"/api/del_msg",
		[["id", fullname]],
		true,
		{ method: "POST" }
	);

	return isObjectEmpty(response);
}

export interface CreateOrUpdateModel {
	description_md?: string,
	display_name?: string,
	subreddits?: { name: string }[],
	visibility?: "private" | "public" | "hidden"
}
export async function createOrUpdateMulti(multiPath: string, model: CreateOrUpdateModel) {
	return await redditApiRequest(
		`/api/multi${multiPath}`,
		[["model", JSON.stringify(model)]],
		true,
		{ method: "PUT" }
	);
}

export async function deleteMulti(multiPath: string): Promise<boolean> {
	const res = await redditApiRequest(
		`/api/multi${multiPath}`,
		[], true,
		{ method: "DELETE" }
	);
	return isObjectEmpty(res);
}

export async function getUserPreferences(): Promise<RedditPreferences> {
	return await redditApiRequest("/api/v1/me/prefs", [], true);
}

export async function updateUserPreferences(newPrefs: RedditPreferences) {
	await redditApiRequest("/api/v1/me/prefs", JSON.stringify(newPrefs), true, {
		method: "PATCH",
		headers: {
			"content-type": "application/json"
		},
	})
}
