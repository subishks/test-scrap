chrome.browserAction.onClicked.addListener(function() {
	chrome.tabs.create({
		url: "https://www.linkedin.com/search/results/people/"
	});
});
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if (request.message === "load") {
		var savedDetails = JSON.parse(localStorage.getItem('savedDetails') || "{}");
		sendResponse(savedDetails);
	} else if (request.message === "save") {
		if (request.toSaveDetails && Object.keys(request.toSaveDetails).length) {
			localStorage.setItem('savedDetails', JSON.stringify(request.toSaveDetails));
			if (request.shouldUpdate) {
				updateScript(request.toSaveDetails);
			}
		}


		sendResponse();
	} else if (request.message === "options") {
		chrome.runtime.openOptionsPage();
	}

	return false;

});
// Adding Support for HTML5 web navigation using PushState and replaceState
// needed only New linkedUI since it is only one using this method to load new pages
//
chrome.webNavigation.onHistoryStateUpdated.addListener(function(details) {
	// looking for new search page URL and loading content_scripts
	if(details.url.match(/:\/\/www\.linkedin\.com\/search\/results\/people\/*/)){
		chrome.tabs.executeScript(null,{file:"jquery.min.js"},function(){
			chrome.tabs.executeScript(null,{file:"run_new.js"});
		});
	}
});

function updateScript(updateValue) {
	chrome.tabs.query({
		url: [
			"*://www.linkedin.com/vsearch/f*",
			"*://www.linkedin.com/sales/search*",
				"*://www.linkedin.com/search/results/*"
		]
	}, function(tabs) {
		for (var i = 0; i < tabs.length; i++) {
			chrome.tabs.sendMessage(tabs[i].id, {
				action: "update",
				value: updateValue
			});
		}
	});
}
