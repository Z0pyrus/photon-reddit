import { viewsStack } from "../../../state/stateManager.js";
import { HistoryState } from "../../../utils/types.js";
import { Ph_ViewState } from "../viewState.js";

export default class Ph_ViewStateLoader extends Ph_ViewState {
	constructor(state: HistoryState) {
		super(state);
		this.innerHTML = "loading...";
	}

	finishWith(elem: HTMLElement) {
		this.innerHTML = "";
		this.addEventListener("click", this.onBackAreaClick);
		this.appendChild(elem);
	}

	onBackAreaClick(e: MouseEvent) {
		if (e.currentTarget !== e.target || !viewsStack.hasPreviousLoaded())
			return;
		
		history.back();
	}
}

customElements.define("ph-view-state-loader", Ph_ViewStateLoader);