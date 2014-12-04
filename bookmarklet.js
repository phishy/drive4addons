"use strict";

var drive;

/**
 * Constructor sets variables from config parameter
 *
 * Uses idiomatic.js style guide
 *
 * @construct
 * @param config
 * @constructor
 */
function Drive4Addons(config) {
    this.clientId = config.clientId;
    this.apiKey = config.apiKey;
    this.scopes = config.scopes;
    this.authenticated = false;
    this.projectId = null;
    this.projectFolder = null;
}

/**
 * Uses Google OAuth 2 API to authenticate
 */
Drive4Addons.prototype.auth = function () {

    var opts = { client_id: this.clientId, scope: this.scopes, immediate: false };

    gapi.client.setApiKey(this.apiKey);

    gapi.auth.authorize(opts, function (authResult) {

        if (authResult && !authResult.error) {
            $('li.gbt').append('<span>Drive4AddOns Enabled.</span>');
            goog.shell.showMessage(false, 'Drive4Addons does not intercept your data. All data is transmitted directly from your browser to Google.');
            this.authenticated = true;
        } else {
            console.log('Drive4Addons.auth error', authResult);
        }
        return this.authenticated;
    }.bind(this));
};

/**
 * Shows a message to the user
 * @param msg
 */
Drive4Addons.prototype.showMessage = function (msg) {

    goog.shell.showMessage(2, msg);

};

/**
 * Creates a folder on Google Drive
 * @param title
 * @param cb
 */
Drive4Addons.prototype.createFolder = function (title, cb) {

    var meta = {
        title: title,
        mimeType: 'application/vnd.google-apps.folder'
    };

    gapi.client.request({

        method: 'POST',
        path: '/drive/v2/files',
        body: JSON.stringify(meta)

    }).then(function (res) {

        cb(null, res.result);

    }, function(err){
        console.log('Drive4Addons.createFolder error', err);
        cb(err);
    });
};

/**
 * Searches for files on Google Drive given a querystring
 * @param q
 * @param cb
 */
Drive4Addons.prototype.search = function (q, cb) {
    gapi.client.request({
        method: 'GET',
        path: "/drive/v2/files",
        params: { q: q }
    }).then(function (res) {
        cb(null, res);
    }, function(err) {
        console.log('Drive4Addons.search error', q, err);
        cb(err, null);
    });
};

/**
 * Saves a file on Google Drive into a folder named with the projectId
 * @param projectId
 * @param filename
 * @param data
 */
Drive4Addons.prototype.save = function (projectId, filename, data) {
    if (!this.projectFolder) {
        this.search("title='" + projectId + "'", function (err, res) {
            if (res.result.items.length) {
                this.projectFolder = res.result.items[ 0 ];
                this.save(projectId, filename, data);
            } else {
                this.createFolder(projectId, function (err, res) {
                    if (err) {
                        console.log(err);
                        return false;
                    }
                    this.projectFolder = res;
                    this.save(projectId, filename, data);
                }.bind(this));
            }
        }.bind(this));
    } else {
        var query = _.template("title='<%= filename %>' and '<%= projectFolder.id %>' in parents");
        this.search(query({ filename: filename, projectFolder: this.projectFolder }), function (err, res) {
            if (!res.result.items.length) {
                gapi.client.request({
                    method: 'POST',
                    'path': '/upload/drive/v2/files',
                    'headers': {
                        'Content-Type': 'text/javascript'
                    },
                    'body': data
                }).then(function (resp) {
                    var request = gapi.client.request({
                        method: 'PATCH',
                        'path': '/drive/v2/files/' + resp.result.id,
                        'body': JSON.stringify({ title: filename, parents: [
                            { id: this.projectFolder.id }
                        ]})
                    }).then(function (resp) {
                        this.showMessage('Code saved to Google Drive folder ' + this.projectId);
                    }.bind(this));
                }.bind(this));
            } else {
                gapi.client.request({
                    method: 'PATCH',
                    'path': '/drive/v2/files/' + res.result.items[ 0 ].id,
                    'body': JSON.stringify({ title: filename, parents: [
                        { id: this.projectFolder.id }
                    ]})
                }).then(function (resp) {
                    this.showMessage('Code saved to Google Drive folder ' + this.projectId);
                }.bind(this));
            }
        }.bind(this));
    }
};

/**
 * Handler method for XHR complete
 * @param obj
 * @param data
 * @returns {boolean}
 */
Drive4Addons.prototype.onReadyStateChangeComplete = function (xhr, data) {
    var pieces, filename, body;

    if (xhr.responseText.indexOf('//OK') < 0) {
        return true;
    }
    pieces = data.split('|');
    if (pieces.length != 23) {
        return true;
    }

    this.projectId = pieces[ 4 ];
    filename = pieces[ 8 ];
    body = pieces[ 10 ];

    return this.save(this.projectId, filename, body);
};

drive = new Drive4Addons({
    clientId: '487044269291-suaq47gvp6kbn2rifg24t17paft5mcul.apps.googleusercontent.com',
    apiKey: 'AIzaSyBSW3RekeJ05IqjoG6k0igNO9QPBh5Afww',
    scopes: 'https://www.googleapis.com/auth/plus.me https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file'
});

console.log('Drive for Add-ons loaded successfully');

/**
 * The following code was borrowed and modified with infinite gratitude from:
 * https://gist.github.com/suprememoocow/2823600
 *
 */
(function (XHR, drive) {

    var timeoutId = null, open = XHR.prototype.open, send = XHR.prototype.send;

    XHR.prototype.open = function (method, url, async, user, pass) {
        this._url = url;
        open.call(this, method, url, async, user, pass);
    };

    XHR.prototype.send = function (data) {
        var self = this, oldOnReadyStateChange, url = this._url;

        function onReadyStateChange() {
            if (self.readyState == 4 /* complete */) {
                drive.onReadyStateChangeComplete(self, data);
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
    };
})(XMLHttpRequest, drive);




