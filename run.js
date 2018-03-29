var stopping = false;
var intervals = [];

var savedDetails = {};

var stoppingAfter;
var tokenKey =  "VTNWNVlYUnBNVEl6ZVdWelpHRjBZVGM0T1E9PQ=="
var text_done = '(Done)';
var text_err = '(Error)'
var text_already_done = '(Skipped - Already Done)';
var text_visiting_extracting = '(Visiting & Extracting)';
var text_next_to_visit = '(Next To Visit)';
var color_done = '#39D5FF';
var color_already_done = '#E7E7E7';
var color_visiting_extracting = '#5EFAF7';
var color_next_to_visit = '#FFCCBC';
var color_on_api_fail = 'rgb(255, 78, 38)'
var request_timeout = 20000;
var APIURL = "https://www.yesdata.io/restapi.php"
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

	$('#extractor-stopping-after-number').text(stoppingAfter);
	$('.inch-worm-status').text("WORKING")
	$('.inch-worm-image').show()
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

	var peopleRows = $('#results .people');
	var personRow = peopleRows[i];

	var personTitle = $(personRow).find('a.title');

	if (personRow && personTitle) {
		var nowText = $(personTitle).text();
		var personLink = $(personTitle).attr('href');

		i++;
		if(nowText.indexOf(text_next_to_visit) > -1 ){

			//dont visit again if already visited
		}else if (!personLink || nowText.indexOf('LinkedIn Member') > -1 || nowText.indexOf(
				text_next_to_visit) > -1 || nowText.indexOf(text_done) > -1 || nowText.indexOf(
				text_already_done) > -1 || !canVisit(personLink)) {

			if (nowText.indexOf(text_already_done) === -1) {
				nowText = nowText.replace(' ' + text_done, '').replace(' ' +
					text_next_to_visit, '');
				$(personTitle).text(nowText + ' ' + text_already_done);
				$(personRow).css('background-color', color_already_done);
			}

			startVisiting(i);
			return;
		}


		if(nowText.indexOf(text_next_to_visit) == -1){
			nowText += " " + text_next_to_visit;
		}
		$(personRow).css('background-color', color_next_to_visit);
		$(personTitle).text(nowText);

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
					$(personTitle).text(nowText);
					$(personRow).css('background-color', color_visiting_extracting);
				}
				visitPerson(personLink, function(profileDetails, error) {
					if(error){
						nowText = nowText.replace(text_visiting_extracting, text_err);
						$(personTitle).text(nowText);
						$(personRow).css('background-color', color_on_api_fail);
					}else{
						saveOrPrint(profileDetails, personRow, nowText);
						if (nowText.indexOf(text_done) === -1) {
							nowText = nowText.replace(text_visiting_extracting, text_done);
							$(personTitle).text(nowText);
							$(personRow).css('background-color', color_done);
						}
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
		var next = $('a.page-link[rel="next"]');

		if (next && next.length) {
			$('a.page-link[rel="next"]')[0].click();

			setTimeout(function() {
				startVisiting(0);
			}, 8000);
		} else {
			stoppingAfter = 0;
			stop();
		}
	}
}

function visitPerson(link, completed) {
	$.ajax({
		url: link,
		type: 'post',
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

		var name = $($(html).find('.full-name')).text();
		var firstName, lastName;
		var names = name.split(" ")
		firstName = names[0]
		lastName = names[names.length - 1]
		var headline = $($(html).find('#headline')).text();
		var title = $($(html).find(
			'#background-experience .current-position header h4')).map(function() {
			return $(this).text();
		}).get().join(', ');
		var currentTitle = title.split(" ,")[0]
		var locality = $($(html).find('#top-card .locality')).text();
		var industry = $($(html).find('#top-card .industry')).text();
		var currentCompanies = $($(html).find('#overview-summary-current ol')).text();
		var currentCompany = currentCompanies.split(",")[0]
		var previousCompanies = $($(html).find('#overview-summary-past ol')).text();
		var lastCompany = $($(html).find(
			'#overview-summary-current a[href*="/company"]:first'));

		var lastCompanyLink = '';

		var education = $($(html).find('#overview-summary-education ol')).text();

		var connections = $($(html).find('.member-connections > strong > a')).text();
		var skills = $($(html).find('#profile-skills .endorse-item-name-text')).map(
			function() {
				return $(this).text();
			}).get().join(', ');

		var interests = $($(html).find('#interests-view li')).text();

		var link = $($(html).find('#top-card .view-public-profile')).text();

		var companyWebsite = '';
		var time = new Date()
		if(currentCompanies == ""){
			currentCompanies = $($(html).find(
				'#background-experience .current-position header h5 strong a')).map(function() {
				return $(this).text();
			}).get().join(", ")
			currentCompany = currentCompanies.split(" ,")[0]
			lastCompany = $($(html).find(
				'#background-experience .current-position header h5 strong a[href*="/company"]:first'));
		}
		if (lastCompany && lastCompany.attr('href')) {
			lastCompanyLink = 'https://www.linkedin.com' + lastCompany.attr('href');
		}
		var profileId = link.split("/")
		profileId = profileId[profileId.length - 1].split('-')
		profileId = profileId[ profileId.length - 1]
		var profileDetails = {
			name: name,
			headline: headline,
			title: title,
			locality: locality,
			industry: industry,
			currentCompanies: currentCompanies,
			connections: connections,
			profileId : profileId,
			link: link,
			currentCompany : currentCompany,
			currentTitle: currentTitle,
			visited : time.toISOString(),
			firstName : firstName,
			lastName: lastName,
			previousCompanies: previousCompanies,
			lastCompany: lastCompanyLink,
			education: education,
			skills: skills,
			interests: interests,
			companyWebsite: companyWebsite,
			twitter_handle: ""
		};

		if (!lastCompanyLink) {
			completed(profileDetails);
			return;
		} else {
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
				var companyWebsite = JSON.parse(str).website;
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
			});
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
	$('#extractor-visited').text(visited);
	chrome.runtime.sendMessage({
		'message': 'save',
		'toSaveDetails': savedDetails
	});
}

function saveOrPrint(details,personRow, nowText) {
	var API = savedDetails.API;
	if (API) {
		try {
			details.apikey = API
			$.ajax({
				url: APIURL,
				type: 'POST',
				dataType: 'json',
				contentType: 'application/json',
				data: JSON.stringify({data : [details]}),
				headers: {
					"x-token" : tokenKey
				},
				error: function(request, status, error){
					console.log(error)
					var personTitle = $(personRow).find('a.search-result__result-link');
					personTitle = personTitle[1]
					nowText = nowText.replace(text_visiting_extracting, text_err);
					$(personRow).css('background-color', color_on_api_fail)
				}
			}).complete(function(returned) {
				if(returned.status == 200){
					incrementVisitCount();
					// Uncomment if count need to descrease only on success
					// stopping After --
				}
			});
		} catch (e) {
			console.log(e)
		}

	}else {
		incrementVisitCount();
	}

	console.log(details);
}


function getProfileId(viewLink) {
	var matched = viewLink.match(/targetId%3.*?%/i);
	var idStr = '';

	if (matched) {
		idStr = matched[0];
	}

	return idStr.replace(/%/gi, '').replace(/targetId/i, '').trim();
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
			$('#srp_main_').append(toolbarHTML);

			if (API) {
				$('#extractor-save-to').val(API);
			}

			var API = savedDetails.API || '';

			var day = savedDetails.day || 0;
      var visited = $('#extractor-visited').val() || 0;

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

			$('#extractor-visited').text(visited);

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
$(function() {
	$(document).on('change','#extractor-skip-days', function() {
		var text = $(this).text();
		var self = this;

		var daysSkip = $('#extractor-skip-days').val();
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
	if(!$("#toolbar").length && location.href.match(/:\/\/www\.linkedin\.com\/vsearch\/f*/)){
		$('#srp_main_').on('click', '#extractor-start-button', function() {
			var text = $(this).text();

			if (text === 'START') {
				start();
			} else {
				stop();
			}
		});

		$('#srp_main_').on('click', '#extractor-options', function() {
			chrome.runtime.sendMessage({
				'message': 'options'
			});
		});

		$('#srp_main_').on('change', '#extractor-stopping-number', function() {
			var max = parseInt($(this).attr('max'));
			var min = parseInt($(this).attr('min'));

			if ($(this).val() > max) {
				$(this).val(max);
			} else if ($(this).val() < min) {
				$(this).val(min);
			}
		});

		initialize();
	}
});

//add more functions

function getNowDate(){

    //EST
    var offset = -5.0

    var localDate = new Date();
    var utc = localDate.getTime() + (localDate.getTimezoneOffset() * 60000);

    var nowETCDate = new Date(utc + (3600000*offset));

    return nowETCDate

}
