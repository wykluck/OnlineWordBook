var curRange;

$(document).ready(function () {
	//$('head').append('<link rel="stylesheet" href="jquery-ui.min.css" type="text/css" />');
    chrome.runtime.onMessage.addListener(
	  function(request, sender, sendResponse) {
        //highlight the text which has been learnt\
        var response = request;
        response.needToSaveToStorage = false;
        if (curRange != null && curRange.toString().trim() == response.selectedWord)
        {
            //the range is still selected and the containing word is the same as when it was requested
            if (curRange.startContainer == curRange.endContainer 
                && curRange.startContainer.parentElement.className == "selected_span")
            {
                //it has been highlighted, just change the title of the span
                var span = $(curRange.startContainer.parentElement);
                span.attr("title", response.def);
            }
            else
            {
                if (curRange != null)
                {
                  ////now extract the sentence that contains the selected word 
                  //var sentenceStr = extractSentence(curRange.startContainer.textContent, curRange.startOffset, response.word);
                  // it has not been highlighted, create the span to highligh it and set the definition
                  var sentenceStr = curRange.startContainer.textContent;

                  //otherwise set the definition to the text of popup
                  var span = $('<span/>', { class: 'selected_span', title: response.def});

                  span.text(curRange.toString());

                  curRange.deleteContents();
                  curRange.insertNode(span[0]);
                }
                response.needToSaveToStorage = true;
                response.example = sentenceStr;
            }
        }
	      sendResponse(response);
	   });
    $('.selected_span').tooltip();
},true);


function extractSentence(sectionStr, wordStartOffset, word)
{
    var sentenceRegx = /(.+?([A-Z].)[\.|\?](?:['")\\\s]?)+?\s?)/igm;
    for (sentence in sectionStr.match(sentenceRegx))
        if (sentence.indexOf(word) != -1)
            return sentence;
}


function getSelectedRange()
{
    var selection = document.getSelection();
    if (selection != null)
    {
        curRange = selection.getRangeAt(0);
    }
    return null;
}

$('body').mouseup(function(){
    getSelectedRange();
    
});

$('body').dblclick(function(event){
     getSelectedRange();
});