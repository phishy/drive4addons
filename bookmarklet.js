var clientId = '487044269291-suaq47gvp6kbn2rifg24t17paft5mcul.apps.googleusercontent.com';
var apiKey = 'AIzaSyBSW3RekeJ05IqjoG6k0igNO9QPBh5Afww';
var scopes = 'https://www.googleapis.com/auth/plus.me https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file';

var authenticated = false;
var projectId = null;
var projectFolder = null;

function auth() {
    gapi.client.setApiKey(apiKey);
    gapi.auth.authorize({client_id: clientId, scope: scopes, immediate: false}, function (authResult) {
        if (authResult && !authResult.error) {
            authenticated = true;
            $('li.gbt').append('<span>Drive4AddOns Enabled.</span>');
        } else {
            console.log('error', authResult);
        }
        return authenticated;
    });
}

function Drive(config) {
//  this.clientId = config.clientId;
//  this.apiKey = config.apiKey;
//  this.scopes = config.scopes;
//  this.authenticated = false;
}

//Drive.prototype.auth = function() {
//  gapi.auth.authorize({client_id: this.clientId, scope: this.scopes, immediate: true}, function (authResult) {
//    if (authResult && !authResult.error) {
//      this.authenticated = true;
//      console.log('authenticated');
//    } else {
//      console.log('not authenticated');
//    }
//  });
//};
Drive.createFolder = function (title, cb) {
    var meta = {
        title: title,
        mimeType: "application/vnd.google-apps.folder"
    };
    var request = gapi.client.request({
        method: 'POST',
        path: '/drive/v2/files',
        body: JSON.stringify(meta)
    }).execute(function (res) {
        cb(null, res);
    });
};

Drive.search = function (q, cb) {
    var request = gapi.client.request({
        method: 'GET',
        path: "/drive/v2/files",
        params: { q: q }
    }).execute(function (res) {
        cb(null, res);
    });
};

Drive.save = function (projectId, filename, data) {
    if (!projectFolder) {
        Drive.search("title='" + projectId + "'", function (err, res) {
            if (res.items.length) {
                projectFolder = res.items[0];
                Drive.save(projectId, filename, data);
            } else {
                Drive.createFolder(projectId, function (err, res) {
                    if (err) {
                        console.log(err);
                        return false;
                    }
                    projectFolder = res;
                    Drive.save(projectId, filename, data);
                });
            }
        });
    } else {
        var query = _.template("title='<%= filename %>' and '<%= projectFolder.id %>' in parents");
        Drive.search(query({ filename: filename, projectFolder: projectFolder }), function (err, res) {
            debugger;
            if (!res.items.length) {
                var request = gapi.client.request({
                    method: 'POST',
                    'path': '/upload/drive/v2/files',
                    'headers': {
                        'Content-Type': 'text/javascript'
                    },
                    'body': data
                });
                request.execute(function (resp) {
                    var request = gapi.client.request({
                        method: 'PATCH',
                        'path': '/drive/v2/files/' + resp.id,
                        'body': JSON.stringify({ title: filename, parents: [
                            { id: projectFolder.id }
                        ] })
                    }).execute(function (resp) {
                        goog.shell.showMessage(null, 'Code saved to Google Drive folder ' + projectId);
                    });
                });
            } else {
                var request = gapi.client.request({
                    method: 'PATCH',
                    'path': '/drive/v2/files/' + res.items[0].id,
                    'body': JSON.stringify({ title: filename, parents: [
                        { id: projectFolder.id }
                    ] })
                }).execute(function (resp) {
                    goog.shell.showMessage(null, 'Code saved to Google Drive folder ' + projectId);
                });
            }
        });
    }
};

(function (XHR) {

    console.log('Google Drive for Add-Ons loaded');


    "use strict";

    var timeoutId = null;

    var open = XHR.prototype.open;
    var send = XHR.prototype.send;

    XHR.prototype.open = function (method, url, async, user, pass) {
        this._url = url;
        open.call(this, method, url, async, user, pass);
    };

    XHR.prototype.send = function (data) {
        var self = this;
        var oldOnReadyStateChange;
        var url = this._url;

        function onReadyStateChange() {
            if (self.readyState == 4 /* complete */) {
                if (self.responseText.indexOf('//OK') < 0) {
                    return true;
                }
                var pieces = data.split('|');
                if (pieces.length != 23) {
                    return true;
                }
                projectId = pieces[4];
                var filename = pieces[8];
                var body = pieces[10];

                if (!timeoutId) {
                    timeoutId = window.setTimeout(function () {
                        Drive.save(projectId, filename, body);
                        timeoutId = null;
                    }, 2000);
                }
            }

            if (oldOnReadyStateChange) {
                oldOnReadyStateChange();
            }
        }

        if (!this.noIntercept) {

            if (this.addEventListener) {
                this.addEventListener("readystatechange", onReadyStateChange, false);
            } else {
                oldOnReadyStateChange = this.onreadystatechange;
                this.onreadystatechange = onReadyStateChange;
            }
        }

        send.call(this, data);
    }
})(XMLHttpRequest);


