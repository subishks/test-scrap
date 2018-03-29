var stopping = false;
var intervals = [];
var savedDetails;
var stoppingAfter;
var tokenKey =  "VTNWNVlYUnBNVEl6ZVdWelpHRjBZVGM0T1E9PQ=="
var text_err = '(Error)'
var text_done = '(Done)';
var text_already_done = '(Skipped - Already Done)';
var text_visiting_extracting = '(Visiting & Extracting)';
var text_next_to_visit = '(Next To Visit)';
var color_done = '#39D5FF';
var color_already_done = '#E7E7E7';
var color_visiting_extracting = '#5EFAF7';
var color_next_to_visit = '#FFCCBC';
var color_on_api_fail = 'rgb(255, 78, 38)'
var account_closed = "account closed"
var closed_account = "closed account"
var request_timeout = 20000;
var APIURL = "https://www.yesdata.io/restapi.php"
var prev_url;
chrome.extension.onMessage.addListener(function(message) {
	if (message.action == 'update' && message.value) {
		savedDetails = message.value;
	}
});

function start() {
	stopping = false;
	$('#extractor-start-button').text('STOP');
  $('#extractor-start-button').css("background","#ff2a2a")
	stoppingAfter = parseInt($('#extractor-stopping-number').val()) || 0;
	$('.inch-worm-status').text("WORKING")
	$('.inch-worm-image').show()
	$('#extractor-stopping-after-number').text(stoppingAfter);

	$('#extractor-stopping').fadeIn();
	startVisiting(0);
}

function stop() {
	stopping = true;
	$('#extractor-start-button').text('START');
	$('#extractor-start-button').css("background","#86aa3f")
	$('#extractor-stopping').hide();
	if(stoppingAfter){
		$('.inch-worm-status').text("")
		$('.inch-worm-image').hide()
	}else{
		$('.inch-worm-status').text("COMPLETED")
		$('.inch-worm-image').show()
	}
	for (var i = 0; i < intervals.length; i++) {
		clearInterval(intervals[i]);
	}
}

function startVisiting(i) {
	if (stopping) {
		stop();
		return;
	}
	var peopleRows = $('.results-list').children();
	var personRow = peopleRows[i]


	var personTitle = $(personRow).find('a.search-result__result-link')[1];

	if (personRow && personTitle) {
		var nowText = $(personRow).find('a.search-result__result-link h3 span span.name').text();
		var personLink = $(personRow).find('a.search-result__result-link').attr('href');

		i++;
		var closed_user = ( nowText.toLowerCase().indexOf(account_closed) > -1 || nowText.toLowerCase().indexOf(closed_account) > -1)
		var skip_unwanted_user = ( !personLink || nowText.indexOf('LinkedIn Member') > -1 || closed_user || nowText.length === 0)
		var skip_finished_user = ( nowText.indexOf(text_done) > -1 || nowText.indexOf(text_already_done) > -1 )
		//dont visit again if already visited
 		if (nowText.indexOf(text_next_to_visit) == -1 && ( skip_unwanted_user ||
			skip_finished_user || !canVisit(personLink) )) {
			if (nowText.indexOf(text_already_done) === -1) {
				nowText = nowText.replace(' ' + text_done, '').replace(' ' +
					text_next_to_visit, '');
				$(personRow).find('a.search-result__result-link h3 span span.name').text(nowText + ' ' + text_already_done);
				$(personRow).css('background-color', color_already_done);
			}
			startVisiting(i);
			return;
		}

		if(nowText.indexOf(text_next_to_visit) == -1){
			nowText += " " + text_next_to_visit;
		}
		$(personRow).css('background-color', color_next_to_visit);
		$(personRow).find('a.search-result__result-link h3 span span.name').text(nowText);

		var delay = Math.round(Math.random() * (25000 - 10000)) + 10000;
		var delayS = Math.round(delay / 1000);

		$('#extractor-next-visit').val(delayS + 's');

		var interval = setInterval(function() {
			delayS--;

			$('#extractor-next-visit').val(delayS + 's');

			if (delayS <= 0) {
				var intervalIndex = intervals.indexOf(interval);
				if (intervalIndex > -1) {
					clearInterval(intervals[intervalIndex]);
					intervals.splice(intervalIndex, 1);
				}

				if (nowText.indexOf(text_visiting_extracting) === -1) {
					nowText = nowText.replace(text_next_to_visit, text_visiting_extracting);
					$(personRow).find('a.search-result__result-link h3 span span.name').text(nowText);
					$(personRow).css('background-color', color_visiting_extracting);
				}

				visitPerson(personLink, personRow, function(profileDetails,error) {
					if(error){
						nowText = nowText.replace(text_visiting_extracting, text_err);
						$(personRow).find('a.search-result__result-link h3 span span.name').text(nowText);
						$(personRow).css('background-color', color_on_api_fail);
					}else{
						saveOrPrint(profileDetails, personRow, nowText);
						if (nowText.indexOf(text_done) === -1) {
							nowText = nowText.replace(text_visiting_extracting, text_done);
							$(personRow).find('a.search-result__result-link h3 span span.name').text(nowText);
							$(personRow).css('background-color', color_done);
						}
						// comment below if count to decrease on success
						stoppingAfter--;
					}

					$('#extractor-stopping-after-number').text(stoppingAfter);
					if (stoppingAfter <= 0) {
						stop();
					} else {
						startVisiting(i);
					}

					return;
				});
			}
		}, 1000);

		intervals.push(interval);
	} else {
		var next = $('.results-paginator button.next');

		if (next && next.length) {
			$('.results-paginator button.next')[0].click();
			setTimeout(function() {
				startVisiting(0);
			}, 6000);
		} else {
			stoppingAfter = 0;
			stop();
		}
	}
}

function visitPerson(link, personRow, completed) {
	$.ajax({
		url: link,
		headers: {
			'contentType': 'application/x-www-form-urlencoded'
		},
		timeout: request_timeout,
		error: function(request, status, error){
			console.log(error)
			completed({},error)
		}
	}).done(function(data) {
		var html = $.parseHTML(data);
		var html = $('<div/>').html(html);
		var code = $($(html).find('code'));
		var firstName, lastName ;
		var data_index  = null;
		var connect_container = null;
		for(var i = 0; i < code.length; i++){
			if($(code[i]).text().indexOf("/networkinfo") != -1){
				connect_container = i - 1
				break;
			}
		}
		var connections = 0;
		try {
			var connection_hash = JSON.parse($(code[connect_container]).text())
		}catch(e){
			console.log(e)
			completed({},e)
			return
		}
		if(connection_hash["data"]){
			if("connectionsCount" in connection_hash["data"]){
				connections = connection_hash["data"]["connectionsCount"]
				if(connections == 500){
					connections = connections.toString() + "+"
				}
			}

		}
		for(i = 0 ;i < code.length; i++){
			if($(code[i]).text().indexOf("/profileView") != -1){
				data_index = i - 1
				break;
			}
		}
		var endorsedSkills_index = null;
		for( i = 0 ;i < code.length; i++){
			if($(code[i]).text().indexOf("/featuredSkills") != -1){
				endorsedSkills_index = i - 1
				break;
			}
		}
		var skills = []
		if(endorsedSkills_index){
			try {
				var endorsedSkills = JSON.parse($(code[endorsedSkills_index]).text())
				if (endorsedSkills && "included" in endorsedSkills){
					endorsedSkills = endorsedSkills["included"]
				}else{
					completed({},"Error: included key not present")
					return
				}
				for( i = 0 ; i < endorsedSkills.length; i++){
					if("entityUrn"in endorsedSkills[i] && endorsedSkills[i]["entityUrn"].indexOf("urn:li:fs_skill:") != -1 &&"name" in endorsedSkills[i]){
						skills.push(endorsedSkills[i]["name"])
					}
				}
			} catch (e){
				console.log(e)
				completed({},e)
				return
			}
		}
		try {
			var data_array = JSON.parse($(code[data_index]).text())["included"]
		}catch(e){
			console.log(e)
			completed({},e)
			return
		}
		var name;
		var headline;
		var profileId = data_array[data_array.length - 1]["publicIdentifier"].split('-')
		profileId = profileId[profileId.length - 1]
		var education = []
		var location = ""
		var industry = ""
		for(i in data_array){
			if(data_array[i]["entityUrn"] && data_array[i]["entityUrn"].indexOf("fs_education:") != -1){
				education.push(data_array[i]["schoolName"])
			}else if (data_array[i]["entityUrn"] && data_array[i]["entityUrn"].indexOf("urn:li:fs_profile:") != -1) {
				location = data_array[i]["locationName"]
				industry = data_array[i]["industryName"]
				headline = data_array[i]["headline"]
				firstName = data_array[i]["firstName"]
				lastName = data_array[i]["lastName"]
				name =  firstName + " " + lastName
			}
		}
		education = education.join(",")
		try {
			var data_keys = JSON.parse($(code[data_index]).text())["data"]
		}catch(e){
			console.log(e)
			completed({},e)
			return
		}
		var postionId = ""
		var educationId= ""
		for(var elem in data_keys){
			if( elem == "positionView"){
				postionId = data_keys[elem]
			}else if (elem == "educationView") {
				educationId = data_keys[elem]
			}
		}
		var lPostions = []
		var currentCompanies = []
		var currentTitles = []
		var title = []
		var currentCompany = ""
		var previousCompanies = []
		var id_list = {}
		var entityUrn_list = {}
		for( i =0; i < data_array.length; i++){
			if(data_array[i]["$id"]){
				id_list[data_array[i]["$id"]] = data_array[i]
			}
			if(data_array[i]["entityUrn"]){
				entityUrn_list[data_array[i]["entityUrn"]] = data_array[i]
			}
		}
		if(postionId in id_list){
			lPostions = id_list[postionId]["elements"]
		}
		var lastCompanyLink = ""
		for ( var elem in entityUrn_list){
			// if(lPostions.indexOf(elem) != -1){
					var timePeroid = entityUrn_list[elem]["timePeriod"]
					if( timePeroid in id_list && id_list[timePeroid]["$deletedFields"].length == 1 ){
						if ( currentCompanies.indexOf(entityUrn_list[elem]["companyName"]) == -1) {
							currentCompanies.push(entityUrn_list[elem]["companyName"])
						}
						currentTitles.push(entityUrn_list[elem]["title"])
						title.push(entityUrn_list[elem]["title"])
					}
					if( timePeroid in id_list && id_list[timePeroid]["$deletedFields"].length == 0){
						if (  previousCompanies.indexOf(entityUrn_list[elem]["companyName"]) == -1){
							previousCompanies.push(entityUrn_list[elem]["companyName"])
						}
						title.push(entityUrn_list[elem]["title"])
					}
			// }
		}
		if(currentTitles.length){
			var currentTitle = currentTitles[0]
		}else{
			var currentTitle = ""
		}
		// if(currentCompanies.length){
		// 	var currentCompany = currentCompanies[0]
		// }else{
		// 	var currentCompany = ""
		// }
		if(currentCompanies.length) {
			for ( var index in currentCompanies) {
				if(currentCompanies[index] != undefined && currentCompanies[index]!= "" ) {
				var currentCompany = currentCompanies[index]
				break
				}
			}			
		}
		
		var educationList = []
		if( educationId in id_list){
			educationList = id_list[educationId]["elements"]
		}
		var schoolNames = []
		for ( var elem in entityUrn_list){
			// if(educationList.indexOf(elem) != -1){
				schoolNames.push(entityUrn_list[elem]["schoolName"])
			// }
		}
		var interests = ""
		var entityUrnId;
		for( var elem in entityUrn_list){
			if(elem.indexOf("urn:li:fs_miniCompany:") != -1 && entityUrn_list[elem]["name"] == currentCompany){
				entityUrnId = entityUrn_list[elem]["entityUrn"].split(":")
				lastCompanyLink = "https://www.linkedin.com/company-beta/"+entityUrnId[entityUrnId.length - 1]+"/"
			}
		}
		var companyWebsite = ""
		var profileContactInfo = null;
		var twitter_handle = ""
		var profileContactInfo_index = null;
		for( i = 0 ;i < code.length; i++){
			if($(code[i]).text().indexOf("/profileContactInfo") != -1){
				profileContactInfo_index = i - 1
				break;
			}
		}
		if(profileContactInfo_index){
			try {
				profileContactInfo = JSON.parse($(code[profileContactInfo_index]).text())
			} catch (e){
				console.log(e)
			}
			if(profileContactInfo && "data" in profileContactInfo){
				if("primaryTwitterHandle" in profileContactInfo["data"]){
					var primaryTwitterHandle = profileContactInfo["data"]["primaryTwitterHandle"]
					if("included" in profileContactInfo){
						for ( var elem in profileContactInfo["included"]){
							if("$id" in profileContactInfo["included"][elem] && profileContactInfo["included"][elem]["$id"] == primaryTwitterHandle){
								twitter_handle = profileContactInfo["included"][elem]["name"] || ""
							}
						}
					}
				}else if ("twitterHandles" in profileContactInfo["data"] && profileContactInfo["data"]["twitterHandles"].length) {
					var primaryTwitterHandle = profileContactInfo["data"]["twitterHandles"][0]
					if("included" in profileContactInfo){
						for ( var elem in profileContactInfo["included"]){
							if("$id" in profileContactInfo["included"][elem] && profileContactInfo["included"][elem]["$id"] == primaryTwitterHandle){
								twitter_handle = profileContactInfo["included"][elem]["name"] || ""
							}
						}
					}
				}
			}
		}
		var time = new Date()
		var profileDetails = {
			name: name,
			headline: headline,
			title: title.join(', '),
			locality: location,
			industry: industry,
			currentCompanies: currentCompanies.join(', '),
			connections: connections,
			profileId : profileId,
			link: 'https://www.linkedin.com'+link,
			currentCompany : currentCompany,
			currentTitle: currentTitle,
			visited : time.toISOString(),
			firstName : firstName,
			lastName: lastName,
			previousCompanies: previousCompanies.join(', '),
			lastCompany: lastCompanyLink,
			education: schoolNames.join(", "),
			skills: skills.join(", "),
			interests: interests,
			companyWebsite: companyWebsite,
			twitter_handle : twitter_handle
		}
		if(!lastCompanyLink){
			completed(profileDetails);
			return;
		}else{
			$.ajax({
				url: lastCompanyLink,
				type: 'get',
				timeout: request_timeout,
				error: function(request, status, error){
					console.log(error)
					completed(profileDetails)
				}
			}).done(function(data) {
				var htmlAgain = $.parseHTML(data);
				var code = $($(htmlAgain).find('#stream-about-section-embed-id-content'))
					.html() || '{}';
				var str = code.replace("<!--", "").replace("-->", "");
				try {
					var companyWebsite = JSON.parse(str).website;
				} catch(e){
					var companyWebsite = "";
					console.log(e)
				}
				if (companyWebsite)
					profileDetails.companyWebsite = companyWebsite.toLowerCase().trim();
				if(profileDetails.companyWebsite == ""){
					var result = data.split("companyPageUrl&quot;:&quot;")
					if(result.length == 2){
						profileDetails.companyWebsite = result[1].split("&quot;")[0]
					}
				}


				completed(profileDetails);
				return;
		})
	}
	});
}

function incrementVisitCount() {
	var day = savedDetails.day || 0;
	var visited = savedDetails.visited || 0;

	var nowDay = getNowDate().getDate();
	if (day != nowDay) {
		visited = 0;
		savedDetails.day = nowDay;
		savedDetails.visited = 0;
	}

	visited++;

	savedDetails.visited = visited;
	$('#extractor-visited').val(visited);
	chrome.runtime.sendMessage({
		'message': 'save',
		'toSaveDetails': savedDetails
	});
}

function saveOrPrint(details, personRow, nowText) {
	var API = savedDetails.API;
	if (API) {
		details.apikey = API
		try {
			$.ajax({
				url: APIURL,
				type: 'POST',
				dataType: 'json',
				contentType: 'application/json',
				headers: {
					"x-token" : tokenKey
				},
				data: JSON.stringify({data : [details]}),
				error: function(request, status, error){
					console.log(error)
					var personTitle = $(personRow).find('a.search-result__result-link');
					personTitle = personTitle[1]
					nowText = nowText.replace(text_visiting_extracting, text_err);
					$(personRow).find('a.search-result__result-link h3 span span.name').text(nowText);
					$(personRow).css('background-color', color_on_api_fail)
				}
			}).complete(function(returned) {
				if(returned.status == 200){
					incrementVisitCount();
					//  Uncomment if count need to descrease only on success
					//  stopping After --
				}
				console.log(returned)
			});
		} catch (e) {
			$(personRow).css('background-color', color_on_api_fail)
			console.log(e)
		}

	}else{
		incrementVisitCount();
	}

	console.log(details);

}


function getProfileId(viewLink) {
	var viewLink_list = viewLink.split('/')
	return viewLink_list[viewLink_list.length - 2]
}

function canVisit(viewLink) {
	var idStr = getProfileId(viewLink);
	if (!idStr)
		return true;

	if (typeof savedDetails.idsVisited === 'undefined') {
		savedDetails.idsVisited = {};
	}

	var idsVisited = savedDetails.idsVisited;

	var daysSkip = savedDetails.daysSkip;

	if (typeof daysSkip === 'undefined') {
		daysSkip = 365;
		savedDetails.daysSkip = 365;
	}
	var nowTime = new Date().getTime();
	var visitedAgo = idsVisited[idStr] || 0;
	if ((nowTime - visitedAgo) <= daysSkip * 24 * 60 * 1000) {
		return false;
	} else {
		idsVisited[idStr] = nowTime;

		//saved
		savedDetails.idsVisited[idStr] = nowTime;
		chrome.runtime.sendMessage({
			'message': 'save',
			'toSaveDetails': savedDetails
		});
		return true;
	}
}

function initialize() {
	chrome.runtime.sendMessage({
		'message': 'load'
	}, function(returnedDetails) {
		if (returnedDetails)
			savedDetails = returnedDetails;
		$.get(chrome.extension.getURL("toolbar.html"), function(toolbarHTML) {
			$('body').append(toolbarHTML);
			var API = savedDetails.API || '';
			if (!API) {
				$('#extractor-save-to').val(API);
			}
			var day = savedDetails.day || 0;
			var visited = savedDetails.visited || 0;
			var nowDay = getNowDate().getDate();
			if (day != nowDay) {
				visited = 0;
				savedDetails.day = nowDay;
				savedDetails.visited = 0;
				chrome.runtime.sendMessage({
					'message': 'save',
					'toSaveDetails': savedDetails
				});
			}
			$('#extractor-visited').val(visited);

		});
	});

}
function calculateCurrentlySkip(idsVisited, daysSkip) {
	var now = getNowDate().getTime();

	var counter = 0;

	for (var id in idsVisited) {
		if (idsVisited.hasOwnProperty(id)){
			var timestamp = idsVisited[id];
			if ((now - timestamp) <= daysSkip * 24 * 60 * 1000) {
				counter++;
			}
		}
	}
}
function getSearchParams(url,k){
 var p={};
 url.replace(/[?&]+([^=&]+)=([^&]*)/gi,function(s,k,v){p[k]=v})
 return k?p[k]:p;
}
$(function(){
	if(prev_url ){
		var prev_url_hash = getSearchParams(prev_url)
		var cur_url_hash = getSearchParams(history.state.path)
		prev_url = history.state.path
			for(var elem in cur_url_hash){
				if(elem != 'page' && cur_url_hash[elem] != prev_url_hash[elem] ){
					location.reload()
				}
			}
			for(var elem in prev_url_hash){
				if(elem != 'page' && cur_url_hash[elem] != prev_url_hash[elem] ){
					location.reload()
				}
			}
	}else{
		prev_url = history.state.path
	}
})
setTimeout(function(){

	$(function() {
		$(document).on('change','#extractor-skip-days', function() {
			var text = $(this).text();
			var self = this;
			var daysSkip = $('#extractor-skip-days').val();
			savedDetails.visited =$('#extractor-visited').val();
			savedDetails.daysSkip = daysSkip;
			chrome.runtime.sendMessage({
				'message': 'save',
				'toSaveDetails': savedDetails,
				'shouldUpdate': true
			});
			$(this).text("Saved!").attr('disabled', true);
			$('#extractor-skip-number').text(calculateCurrentlySkip(savedDetails.idsVisited,
				savedDetails.daysSkip));

			setTimeout(function() {
				$(self).text(text).attr('disabled', false);
			}, 2000);
		});
		if(!$("#toolbar").length && location.href.match(/:\/\/www\.linkedin\.com\/search\/results\/people\/*/) ){
			$(document).on('click', '#extractor-start-button', function() {
				var text = $(this).text();
				if (text === 'START') {
					start();
				} else {
					stop();
				}
			});

			$(document).on('click', '#extractor-options', function() {
				chrome.runtime.sendMessage({
					'message': 'options'
				});
			});

			$(document).on('change', '#extractor-stopping-number', function() {
				var max = parseInt($(this).attr('max'));
				var min = parseInt($(this).attr('min'));

				if ($(this).val() > max) {
					$(this).val(max);
				} else if ($(this).val() < min) {
					$(this).val(min);
				}
			});

			initialize();
		}else{
			return;
		}

});},5000)

//add more functions

function getNowDate(){

    //EST
    var offset = -5.0

    var localDate = new Date();
    var utc = localDate.getTime() + (localDate.getTimezoneOffset() * 60000);
		// ETC date
    var nowETCDate = new Date(utc + (3600000*offset));

    return nowETCDate

}
