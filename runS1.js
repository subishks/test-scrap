var stopping = false;
var intervals = [];

var savedDetails;

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
var account_closed = "account closed"
var closed_account = "closed account"
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
	$('.inch-worm-image').attr('style','display:inline !important');
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
		$('.inch-worm-image').attr('style','display:inline !important');
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
   var peopleRows = $('#results-list').children();
  var personRow = peopleRows[i];
  //console.log("personRow....", personRow)

  var element = $(personRow).find(".details-container");
  console.log("element....", element);

  var degreeIcon = $(element).find("abbr");
  console.log("degreeIcon....", degreeIcon.length);

  var personTitle = $(personRow).find('.name > a');
  //console.log("personTitle.......", personTitle)

  if (personRow && personTitle) {
    var nowText = $(personTitle).text();
    var personLink = $(personTitle).attr('href');

    i++;
    var closed_user = ( nowText.toLowerCase().indexOf(account_closed) > -1  || nowText.toLowerCase().indexOf(closed_account) > -1 )
    var skip_unwanted_user = ( !personLink || nowText.indexOf('LinkedIn Member') > -1 || closed_user )
		var skip_finished_user = ( nowText.indexOf(text_done) > -1 || nowText.indexOf(text_already_done) > -1 )
		//dont visit again if already visited
 		if (nowText.indexOf(text_next_to_visit) == -1 && ( skip_unwanted_user ||
			skip_finished_user || !canVisit(personLink) )) {

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
    $(personRow).css(
      'background-color', color_next_to_visit);
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
          nowText = nowText.replace(text_next_to_visit,
            text_visiting_extracting);
          $(personTitle).text(nowText);
          $(personRow).css('background-color',
            color_visiting_extracting);
        }
        visitPerson(personLink, function(profileDetails, error) {

          if(error){
            nowText = nowText.replace(text_visiting_extracting, text_err);
            $(personTitle).text(nowText);
            $(personRow).css('background-color', color_on_api_fail);
          }else{
            saveOrPrint(profileDetails, personRow, nowText);
            if (nowText.indexOf(text_done) === -1) {
              nowText = nowText.replace(text_visiting_extracting,
                text_done);
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
    var next = $('a.page-link[title*="Next"]').not('.disabled');

    if (next && next.length) {
      $('a.page-link[title*="Next"]')[0].click();

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
    type: 'get',
    timeout: request_timeout,
    error: function(request, status, error){
      console.log(error)
      completed({},error)
    }
  }).done(function(data) {
    var html = $.parseHTML(data);
    var embeddedJson1 = $(html).filter('#embedded-json');
    var embeddedJson2 = $(html).find('#embedded-json');
    var jsonStr = embeddedJson1.html() || embeddedJson2.html() || '{}';
    jsonStr = jsonStr.replace("<!--", "").replace("-->", "");
    var profileDetails = JSON.parse(jsonStr);

    var positions = ((profileDetails.positionsView || {}).positions) || [];
    var lastPosition = positions[0] || {};
    var lastCompanyLink = lastPosition.companyUrl;
    for(var i in positions ) {
      console.log("eachPos....");
      console.log(positions[i]);
      console.log("8888888888888888888888888888888")
      
    }
    //var lastPosition = positions[1] || {};
    //console.log("lastPosition............", lastPosition)
    //var lastCompanyLink = lastPosition.companyUrl;
    console.log("lastCompanyLink1...."+lastCompanyLink)
    var data = {}
    data["visited"] = new Date().toISOString()
    data["connections"] = ""
    data["companyWebsite"] = ""
    data["lastCompany"] =""
    if(profileDetails["profile"] && profileDetails["profile"]["numConnections"]){
      data["connections"] = profileDetails["profile"]["numConnections"]
    }
    if(profileDetails["profile"] && profileDetails["profile"]["firstName"]){
      data["firstName"] = profileDetails["profile"]["firstName"]
    }else{
      data["firstName"] = ""
    }
    if(profileDetails["profile"] && profileDetails["profile"]["lastName"]){
      data["lastName"] = profileDetails["profile"]["lastName"]
    }else{
      data["lastName"] = ""
    }
    if(profileDetails["profile"] && profileDetails["profile"]["fullName"]){
      data["name"] = profileDetails["profile"]["fullName"]
    }else{
      data["name"] = ""
    }
    if(profileDetails["profile"] && profileDetails["profile"]["headline"]){
      data["headline"] = profileDetails["profile"]["headline"]
    }else{
      data["headline"] = ""
    }
    if(profileDetails["profile"] && profileDetails["profile"]["location"]){
      data["locality"] = profileDetails["profile"]["location"]
    }else{
      data["locality"] = ""
    }
    if(profileDetails["profile"] && profileDetails["profile"]["industry"]){
      data["industry"] = profileDetails["profile"]["industry"]
    }else{
      data["industry"] = ""
    }
    if(profileDetails["profile"] && profileDetails["profile"]["contactInfo"] && profileDetails["profile"]["contactInfo"]["publicProfileUrl"]){
      data["link"] = profileDetails["profile"]["contactInfo"]["publicProfileUrl"]
    }else{
      data["link"] = ""
    }
    if(profileDetails["profile"] && profileDetails["profile"]["skills"]){
      data["skills"] = profileDetails["profile"]["skills"].join(", ")
    }else{
      data["skills"] = ""
    }
    if(profileDetails["profile"] && profileDetails["profile"]["interests"]){
      data["interests"] = profileDetails["profile"]["interests"]
    }else{
      data["interests"] = ""
    }
    if(profileDetails["positionsView"] && profileDetails["positionsView"]["positions"] && profileDetails["positionsView"]["positions"][0] && profileDetails["positionsView"]["positions"][0]["position"] && profileDetails["positionsView"]["positions"][0]["position"]["title"]  ){
      data["title"] = profileDetails["positionsView"]["positions"][0]["position"]["title"]
    }else{
      data["title"] = ""
    }
    if(profileDetails["positionsView"] && profileDetails["positionsView"]["positions"]){
      for( var i in profileDetails["positionsView"]["positions"]){
        if(profileDetails["positionsView"]["positions"][i] && profileDetails["positionsView"]["positions"][i]["position"] && profileDetails["positionsView"]["positions"][i]["position"]["current"] && profileDetails["positionsView"]["positions"][i]["position"]["companyName"] ){
           data["currentCompany"] = profileDetails["positionsView"]["positions"][i]["position"]["companyName"]
           data["currentTitle"] = profileDetails["positionsView"]["positions"][i]["position"]["title"] || ""
           break;
        }
      }
    }else{
      data["currentCompany"] = ""
      data["currentTitle"] = ""
    }
    if(profileDetails["positionsView"] && profileDetails["positionsView"]["positions"]){
      for( var i in profileDetails["positionsView"]["positions"]){
        if(profileDetails["positionsView"]["positions"][i] && profileDetails["positionsView"]["positions"][i]["position"] && !profileDetails["positionsView"]["positions"][i]["position"]["current"] && profileDetails["positionsView"]["positions"][i]["position"]["companyName"] ){
           data["lastCompany"] = profileDetails["positionsView"]["positions"][i]["position"]["companyName"]
           break;
        }
      }
    }else{
      data["lastCompany"] = ""
    }
    var currentCompanies = []
    var previousCompanies = []

    if(profileDetails["positionsView"] && profileDetails["positionsView"]["positions"]){
      for( var i in profileDetails["positionsView"]["positions"]){
        if(profileDetails["positionsView"]["positions"][i] && profileDetails["positionsView"]["positions"][i]["position"] && profileDetails["positionsView"]["positions"][i]["position"]["current"]  && profileDetails["positionsView"]["positions"][i]["position"]["companyName"] ){
          if(currentCompanies.indexOf(profileDetails["positionsView"]["positions"][i]["position"]["companyName"]) == -1){
            currentCompanies.push(profileDetails["positionsView"]["positions"][i]["position"]["companyName"])
          }
        }
      }
    }
    if(profileDetails["positionsView"] && profileDetails["positionsView"]["positions"]){
      for(var i in profileDetails["positionsView"]["positions"]){
        if(profileDetails["positionsView"]["positions"][i] && profileDetails["positionsView"]["positions"][i]["position"]  && !profileDetails["positionsView"]["positions"][i]["position"]["current"]  && profileDetails["positionsView"]["positions"][i]["position"]["companyName"] ){
          if(previousCompanies.indexOf(profileDetails["positionsView"]["positions"][i]["position"]["companyName"]) == -1){
            previousCompanies.push(profileDetails["positionsView"]["positions"][i]["position"]["companyName"])
          }
        }
      }
    }
    data["previousCompanies"] = previousCompanies.join(", ")
    data["currentCompanies"] = currentCompanies.join(", ")
    if(profileDetails["profile"] && profileDetails["profile"]["memberId"]){
      data["profileId"] = profileDetails["profile"]["memberId"]
    }else{
      data["profileId"] = ""
    }
    var education = []
    if(profileDetails["educationsView"] && profileDetails["educationsView"]["schools"]){
      for(var  i in profileDetails["educationsView"]["schools"]){
        if(education.indexOf(profileDetails["educationsView"]["schools"][i]["schoolName"] == -1)){
          education.push(profileDetails["educationsView"]["schools"][i]["schoolName"])
        }
      }
    }
    var twitter_handle = ""
    if("profile" in profileDetails && "contactInfo" in profileDetails["profile"] &&
        "twitterAccounts" in profileDetails["profile"]["contactInfo"] &&
        profileDetails["profile"]["contactInfo"]["twitterAccounts"].length){
      twitter_handle = profileDetails["profile"]["contactInfo"]["twitterAccounts"][0] || ""
    }
    data["twitter_handle"] = twitter_handle
    data["education"] = education.join(", ")
    if (!lastCompanyLink) {
      completed(data);
      return;
    } else {
      lastCompanyLink = window.location.protocol + lastCompanyLink.replace(
        /^https?:/, '');

      $.ajax({
        url: lastCompanyLink,
        type: 'get',
        timeout: request_timeout,
        error: function(request, status, error){
          console.log(error)
          completed(data)
        }
      }).done(function(html) {
        var htmlAgain = $.parseHTML(html);
        //console.log("htmlAgain.....", htmlAgain)
        //var companyCodes = $(htmlAgain).find("code")
        var html1 = $('<div/>').html(htmlAgain);
		    var companyCodes = $($(html1).find('code'));
        //console.log("companyCodes.....", companyCodes)
        // for (var i in companyCodes) {
        //     console.log("***************************")
        //     console.log("companyDetails.....", companyCodes[i])
        //     console.log("************************************")
        //   }
        var companyJson = companyCodes[8]
        console.log("companyJson, ",companyJson) 
        var companyJsonStr = '{}';
        var companyDetails = JSON.parse($(companyJson).text())
        //console.log("connection_hash", connection_hash)
        //companyJsonStr = companyJson.html() || '{}';
        // if (companyJson) {
        //   companyJsonStr = companyJson.html() || '{}';
        // }
        // console.log("companyJsonStr, ",companyJsonStr)
        //companyJsonStr = companyJson.replace("<!--", "").replace("-->", "");
        //var companyDetails = JSON.parse(companyJsonStr);
        console.log("companyDetails, ",companyDetails)
        var companyWebsite = (companyDetails.website || '');
        
        
        
        //var companyJson = $(htmlAgain).find("code").last();
        //console.log("companyJson.....", companyJson)
        //var companyJsonStr = '{}';

        // if (companyJson) {
        //   companyJsonStr = companyJson.html() || '{}';
        // }
        //console.log("companyJsonStr.....", companyJsonStr)

        //companyJsonStr = companyJsonStr.replace("<!--", "").replace(
        //  "-->", "");
        //var companyDetails = JSON.parse(companyJsonStr);
        //console.log("companyDetails.....", companyDetails)
        //var companyWebsite = ((companyDetails.account || {}).website ||
        //  '');

        if (companyWebsite){
          data.companyWebsite = companyWebsite.toLowerCase().trim();
        }
        completed(data);
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
  $('#extractor-visited').val(visited);
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
        headers: {
          "x-token" : tokenKey
        },
				data: JSON.stringify({data : [details]}),
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
          //  Uncomment if count need to descrease only on success
          //  stopping After --
        }
			});
    } catch (e) {}

  }else{
    incrementVisitCount();
    console.log(details)
  }
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

function getProfileId(viewLink) {
  var matched = viewLink.match(/sales\/profile\/.*?,/i);
  var idStr = '';

  if (matched) {
    idStr = matched[0];
  }

  return idStr.replace(/,/gi, '').replace(/sales\/profile\//i, '').trim();
}

function initialize() {
  chrome.runtime.sendMessage({
    'message': 'load'
  }, function(returnedDetails) {
    if (returnedDetails)
      savedDetails = returnedDetails;

    $.get(chrome.extension.getURL("toolbar.html"), function(toolbarHTML) {
      $('#stream-container').append(toolbarHTML);

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
    if (idsVisited.hasOwnProperty(id)) {
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
  if(!$("#toolbar").length && location.href.match(/:\/\/www\.linkedin\.com\/sales\/search*/)){
    $('#stream-container').on('click', '#extractor-start-button',
      function() {
        var text = $(this).text();
        if (text === 'START') {
          start();
        } else {
          stop();
        }
      });

    $('#stream-container').on('click', '#extractor-options', function() {
      chrome.runtime.sendMessage({
        'message': 'options'
      });
    });

    $('#stream-container').on('change', '#extractor-stopping-number',
      function() {
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
