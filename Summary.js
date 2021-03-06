var treeNodeType = {};
treeNodeType.word = 'word';
treeNodeType.definition = 'definition';
treeNodeType.example = 'example';
var modifiedItems = {'removed': [], 'modified': []};
var curWordCount = 0;
var dbStorage = chrome.extension.getBackgroundPage().dbStorage;
var manifest = chrome.runtime.getManifest();
var wordPronunciationMap = {};

$(document).ready(function() {
	resetSummaryItems();
    //document.getElementById("save_button")
    //      .addEventListener("click", saveItems, false);
    document.getElementById("sync_button")
          .addEventListener("click", syncWithRemote, false);
    document.getElementById("export_button")
          .addEventListener("click", exportToHtml, false);  
    //document.getElementById("refresh_button")
    //      .addEventListener("click", resetSummaryItems, false);   
});


function convertToJsTreeInfo(items)
{
	var data = [];
	var wordCount = 0;
//example such as:
// itemObj = {"request": 
//    12345:{
//      "defintion": "request def",
//      "examples":  ["I request him to do the job."]
//    }
//  }
	wordPronunciationMap = {};
	for (var word in items) {
		if (items.hasOwnProperty(word)) {
				//add "request" (the word) to the tree view
				wordCount++;
				//delete the soundUrl property
				var textWord = word;
				if (items[word].hasOwnProperty("pron"))
				{
					textWord = textWord + '\t{' + items[word].pron + '}';
					delete items[word].pron;
				}
				data.push({"id": word, "parent" : "#", "text" : textWord, "type": treeNodeType.word});

				//save the soundUrl to the wordPronunciationMap delete the soundUrl property
				if (items[word].hasOwnProperty("soundUrl"))
				{
					wordPronunciationMap[word] = items[word].soundUrl;
					delete items[word].soundUrl;
				}
				
				for (var defHash in items[word])
				{
					if (items[word].hasOwnProperty(defHash))
					{
						//add the definition item under the word item to the tree view
						data.push({"id": defHash, "parent": word, "text": items[word][defHash].definition, "type": treeNodeType.definition});
						items[word][defHash]['examples'].forEach(function(example, index)
						{
							//add the example item under the same definition item to the tree view
							data.push({"id": word + "_example_" + index, "parent": defHash, "text": example, "type": treeNodeType.example});
						});
					}
				}
		}
	}
	return {'wordCount': wordCount, 'data': data};
}

function setSummaryTitle(wordCount)
{
	curWordCount = wordCount;
	var loginStr = 'Account: None; ';
	if (dbStorage.getLoginDetail().length > 0)
		loginStr = 'Account: ' + dbStorage.getLoginDetail() + '; '

	chrome.browserAction.setTitle({'title': loginStr + ' Wordbook: ' + curWordCount + ' words.'});
}

function resetSummaryItems()
{
	dbStorage.getLocalDB().get(manifest.name).then(function(doc) {
		setSummaryItems(doc.data);		
	}).catch(function (err) {
		if (err.status == 404)
			setSummaryTitle(0);
  		else
  			console.log(err);
	});
}

function setSummaryItems(items)
{
	//convert items to jstree json
	var treeInfo = convertToJsTreeInfo(items);

	$("#Search_summary_tree").keyup(function() {

        var searchString = $(this).val();
        $('#Summary_tree_div').jstree('search', searchString);
    });

	//the code below hook up the hotkeys with the corresponding context menus
	$('#Summary_tree_div').on('keydown.jstree', '.jstree-anchor', function (e) {
        var reference = this;
        var instance = $.jstree.reference(this);
        var selected = instance.get_selected([true]);
        var items = instance.settings.contextmenu.items(selected[0]);
        for(var i in items){
            if(items[i].shortcut === e.which) {
                items[i].action({reference:reference});
            }
        }
    });


	//set the jstree data to point to the data
	var tree = $('#Summary_tree_div').jstree({
		'core' : {
			'data' : treeInfo.data,
			'check_callback' : true,
		},
		'contextmenu':{         
		    "items": function($node) {  
		        var contextMenuItems = {
		            //disable edit and remove context menu
		            /*"Edit": {
		                "label":  '<div class="lW"><span class="sc">E</span>dit<span class="hotkey">e</span></div>',
		                "shortcut": 69, //key "E"
		                "shortcut_label": "e",
		                "action":  function () {
                            tree.jstree().edit($node, $node.text, function(node, status, cancelled){
                            	//track the edit change   
	                            if (status && !cancelled)
	                            {
	                            	if (node.original.type == treeNodeType.example)
		                            {
		                            	AddModifiedItem(tree, node);
		                            }
		                        }
                            });
                        }
		            }, */                        
		            "Remove": {
		                "label":  '<div class="lW"><span class="sc">R</span>emove<span class="hotkey">r</span></div>',
		                "shortcut": 82, //key "R"
		                "shortcut_label": "r",
		                "action": function () {
                            //track the removal change
                            var removalObj = {};
                            switch ($node.original.type)
		        			{
		        			 case treeNodeType.word:
		        			 	removalObj[treeNodeType.word] = $node.id;
		        			 	modifiedItems.removed.push(removalObj);
		        			 	//update the wordcount
		        			 	curWordCount--;
		        			 	break;
		        			 case treeNodeType.definition:
		        			 	removalObj[treeNodeType.word] = tree.jstree().get_node($node.parent).id;
		        			 	removalObj[treeNodeType.definition] = $node.id;
		        			 	modifiedItems.removed.push(removalObj);
		        			 	break;
		        			 case treeNodeType.example:
		        			 	removalObj[treeNodeType.word] = tree.jstree().get_node($node.parent).parent;
		        			 	removalObj[treeNodeType.definition] = tree.jstree().get_node($node.parent).id;
		        			 	removalObj[treeNodeType.example] = $node.text;
		        			 	modifiedItems.removed.push(removalObj);
		        			 	break;
		        			 default:
		        			  	break;
		        			}
		        			//delete the node
                            tree.jstree().delete_node($node);
                            //here directly save items to localDb
                            saveItems();
                        }
		            },
		            "Pronounce": {
		            	"label":  '<div class="lW"><span class="sc">P</span>ronunce<span class="hotkey">p</span></div>',
		            	"shortcut": 80, //key "P"
		            	"shortcut_label": "p",
		            	"_disabled": !wordPronunciationMap.hasOwnProperty($node.id),
		                "action": function () {
			            	switch ($node.original.type)
			        		{
			        			 case treeNodeType.word:
			        			 	//play the pronunciation from the wordPronunciationMap
			        				var audio = new Audio(wordPronunciationMap[$node.id]);
									audio.play(); 
									break;
			        			 default:
			        			 	break;
			        		}  	
		        		}
		            }
		        };
		        //limit the context menu items according to the selected node type
		        switch ($node.original.type)
		        {
		        case treeNodeType.word:
		        		//allow remove for word
		        		//delete contextMenuItems.Edit;

		        		break;
		        case treeNodeType.definition:
		        		//allow edit for definition
		        		//delete contextMenuItems.Edit;
		        		delete contextMenuItems.Pronounce;
		        		break;
		        case treeNodeType.example:
		        		//allow both edit and remove for example
		        		delete contextMenuItems.Pronounce;
		        		delete contextMenuItems.Remove;
		        		break;
		        default:
		        		break;
		        };
		        return contextMenuItems;
		    }
		},
		'search' : {
			'search_callback': function(searchStr, $node) {
				if ($node.original.type == treeNodeType.definition || $node.original.type == treeNodeType.example)
				{
					//for definition and example, depends on its parent's visibility to decide
					if (tree.jstree().get_node($node.parent).state.visible === true)
					{
						$node.state.visible = true;
					}
					else
					{
						$node.state.visible = false;
					}
				}	
				else if ($node.id.toLowerCase().includes(searchStr.toLowerCase()))
				{
					//search the searchStr against the word text
					$node.state.visible = true;
				}
				else
				{
					$node.state.visible = false;
				}
				return $node.state.visible;
			},
			'show_only_matches': true
		},
		'sort': function (a, b) {
		 	var wordA = this.get_text(a);
		 	var wordB = this.get_text(b);
		 	if (wordA.indexOf("\t{") > -1 && wordB.indexOf("\t{") > -1)
		 	{
		 		wordA = wordA.substr(0, wordA.indexOf("\t{"));
		 		wordB = wordB.substr(0, wordB.indexOf("\t{"));
		 		return (wordA.toLowerCase() > wordB.toLowerCase() ?  1 : -1);
		 	}
			else
				return true;	
		},
		"plugins" : ["search", "sort", 'contextmenu'] });

	setSummaryTitle(treeInfo.wordCount);
	return;
}

function AddModifiedItem(tree, node)
{
	//traverse child node through its parent definition node 
	var modifiedObj = {};
	modifiedObj[treeNodeType.definition] = tree.get_node(node.parent).id;
    modifiedObj[treeNodeType.word] = tree.get_node(tree.get_node(node.parent).parent).text;
    modifiedObj[treeNodeType.example] = [];
    tree.get_node(node.parent).children.forEach(function(childNodeId) {
    	modifiedObj[treeNodeType.example].push(tree.get_node(childNodeId).text);
    });
    modifiedItems.modified.push(modifiedObj);
}


function saveItems() {
  //Save the tracked modified items to storage
  dbStorage.getLocalDB().get(manifest.name).then(function(doc) {
		var items = doc.data;
		//go through the modified items firstly
		modifiedItems.modified.forEach(function(modifiedItem){
			items[modifiedItem[treeNodeType.word]][modifiedItem[treeNodeType.definition]].examples =
				modifiedItem[treeNodeType.example];
		});

		//go though the removed items secondly
		modifiedItems.removed.forEach(function(removedItem){
			if (removedItem.hasOwnProperty(treeNodeType.example))
			{
				//loop through the examples to find the one to remove
				var exampleToRemove = removedItem[treeNodeType.example];
				items[removedItem[treeNodeType.word]][removedItem[treeNodeType.definition]]
					.examples.every(function(example, index){
						if (example === exampleToRemove)
						{
							items[removedItem[treeNodeType.word]][removedItem[treeNodeType.definition]]
								.examples.splice(index, 1);
							//found one, go out of the loop
							return false;
						}
						else 							
							return true;
					})
			}
			else if (removedItem.hasOwnProperty(treeNodeType.definition))
			{
				delete items[removedItem[treeNodeType.word]][removedItem[treeNodeType.definition]];
			}
			else
			{
				delete items[removedItem[treeNodeType.word]];
			}
		});

		//clear the modified items and save change to chrome storage
		modifiedItems.removed.length = 0;
		modifiedItems.modified.length = 0;
        dbStorage.getLocalDB().put({
        	_id: manifest.name, 
        	_rev: doc._rev,
        	data: items
        }).catch(function (err) {
  			$('#working_status').text("SaveItems failed due to " + err);
		});
  	}).catch(function (err) {
  		$('#working_status').text("SaveItems failed due to " + err);
	});
}

function resolveDocumentConflicts(remoteDBUrl)
{
	//retrieve the synchronized document to refresh the tree items
    dbStorage.getLocalDB().get(manifest.name, {conflicts: true})
    .then(function (doc) {
  		if (doc._conflicts == null || doc._conflicts.length == 0)
  		{
  			//no conflicts, just use the doc data to set tree items
			setSummaryItems(doc.data);
  		}
  		else
  		{
	  		// merge the conflicts to a new document, assume that only 1 conflict exists	
  			dbStorage.getLocalDB().get(manifest.name, {rev: doc._conflicts[0]})
  			.then(function (conflictdoc) {
			   doc.data = Object.assign(doc.data, conflictdoc.data);
			   return doc.data;
			}).catch(function(err) {
				throw err;
			})
			.then(function(mergedData){
				//update the merged document to be on top of the resolved document
				dbStorage.getLocalDB().put({
				   	_id: manifest.name,
				   	_rev: doc._rev,
				   	data: mergedData
			    }).catch(function(err){
			    	$('#working_status').text("Merging documents failed to due to " + err);
			    });
			}) 
			.then(function(){
				//remove the conflict revision
				dbStorage.getLocalDB().remove(manifest.name, doc._conflicts[0]).catch(function(err)
				{
					$('#working_status').text("Removing document conflicts failed to due to " + err);
				});
			})
			.then(function(){
				//sync with remote again
				internalSyncWithRemote(remoteDBUrl);
				//use the doc data to set tree items
				setSummaryItems(doc.data);
			});		
	  	}
	}).catch(function (err) {
	  	$('#working_status').text("Resolving documents failed to due to " + err);
	});

}

function syncWithRemote()
{
	if (dbStorage.getLoginDetail().length == 0)
	{
		alert("Please sign into chrome with a google account to activate sync functionality to remote central database.");
		return;
	}
	//here check remote database exists or not
	if (dbStorage.getRemoteDBUrl() != null && dbStorage.getRemoteDBUrl().length > 0)
	{
	    var remoteDb = new PouchDB(dbStorage.getRemoteDBUrl(), {skip_setup: true});
	    remoteDb.info()
	      .then(function() {
	      	//database exists, start syncing..
	      	internalSyncWithRemote(dbStorage.getRemoteDBUrl());
	      })
	      .catch(function (err) {
	      	//database does not exist, request it to be created.
	      	var requestDB = new PouchDB(dbStorage.getRequestCreationDBUrl(), {skip_setup: true});
		    requestDB.get(manifest.name).then(function(doc) {
		          //append the (database, UTCtime) pair for request the new database against the user name

		          doc[dbStorage.getRemoteDBUrl()] = {
		          			'requestTime': new Date().toUTCString(), 
		          			'isCreated': false
		          		};
		          requestDB.put(doc);
		          alert("Your remote central database is not created yet. It may take 24 hours to be created.");
	        }).then(function(response) {
	        }).catch(function (err) {
	        });
	        
	      });
	}
	
}
function internalSyncWithRemote(remoteDBUrl)
{
	$('#working_status').text("Connecting to remote central database ...");
	var sync = dbStorage.getLocalDB().sync(remoteDBUrl, {
	  live: false,
	  retry: true
	}).on('change', function (info) {
	  // handle change
	  console.log("changes" + info);
	}).on('paused', function (err) {
	  // replication paused (e.g. replication up to date, user went offline)
	  console.log(err);
	}).on('active', function () {
	  // replicate resumed (e.g. new changes replicating, user went back online)
	}).on('denied', function (err) {
	  // a document failed to replicate (e.g. due to permissions)
	  $('#working_status').text("Synchronization failded due to " + err);
	}).on('complete', function (info) {
	  // handle complete
	  $('#working_status').text("Resolving changes between local and remote database.");
	  resolveDocumentConflicts(remoteDBUrl);
	  $('#working_status').text("Synchronization with remote central database has completed successfully!");
	}).on('error', function (err) {
	  $('#working_status').text("Synchronization failded due to " + err);
	});	
}

var saveHTML = function(fileName, htmlElement){
	//this triggers downloading the htmlElement
    var link = document.createElement("a");
    link.download = fileName;
    link.href = "data:text/plain,"+htmlElement;

    link.click(); // trigger click/download
    $('#working_status').text("Export has completed successfully!");
};


function exportToHtml() 
{
	$('#working_status').text("Exporting workbook summary to an html file ...");
	dbStorage.getLocalDB().get(manifest.name).then(function(doc) {
		var wordlist = $('<ul class="word_list"></ul>');
		var items = doc.data;
		for (var word in items)
		{
			if (items.hasOwnProperty(word))
			{
				var wordText = word;
				if (items[word].hasOwnProperty('pron'))
				{
					wordText = word + '\t{' + items[word]['pron'] + '}';
				}
				var wordItem = $('<li>').text(wordText);
				var defList = $('<ul class="def_list"></ul>').appendTo(wordItem);
				for (var hashKey in items[word])
				{
					if (items[word].hasOwnProperty(hashKey) && hashKey != 'soundUrl' && hashKey != 'pron') 
					{
						var defItem = $('<li>').text(items[word][hashKey].definition);
						var exampleList = $('<ul class="example_list"></ul>').appendTo(defItem);
						items[word][hashKey].examples.forEach(function(example){
							exampleList.append($('<li>').text(example));
						});
						defList.append(defItem);
					}					
				}
				wordlist.append(wordItem);
			}
		}

		saveHTML('summary_wordbook.htm', wordlist.html());
		
	}).catch(function (err) {
  		$('#working_status').text("Export failed due to " + err);
	});
		
}
