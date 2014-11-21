"use strict";

/**
 * Configures bookmarklet
 * @construct
 * @param config
 * @constructor
 */
function Drive4Addons( config ) {
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
Drive4Addons.prototype.auth = function() {
  var self = this;
  gapi.client.setApiKey( this.apiKey );
  gapi.auth.authorize({ client_id: this.clientId, scope: this.scopes, immediate: false }, function ( authResult ) {
    if (authResult && !authResult.error) {
      $('li.gbt').append('<span>Drive4AddOns Enabled.</span>');
      goog.shell.showMessage(false, 'Drive4Addons does not intercept your data. All data is transmitted directly from your browser to Google.');
      self.authenticated = true;
    } else {
      console.log('error', authResult);
    }
    return self.authenticated;
  });
};

/**
 * Shows a message to the user
 * @param msg
 */
Drive4Addons.prototype.showMessage = function(msg) {
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

/**
 * Searches for files on Google Drive given a querystring
 * @param q
 * @param cb
 */
Drive4Addons.prototype.search = function (q, cb) {
  var request = gapi.client.request({
    method: 'GET',
    path: "/drive/v2/files",
    params: { q: q }
  }).execute(function (res) {
    cb(null, res);
  });
};

/**
 * Saves a file on Google Drive into a folder named with the projectId
 * @param projectId
 * @param filename
 * @param data
 */
Drive4Addons.prototype.save = function (projectId, filename, data) {
  var self = this;
  if (!this.projectFolder) {
    this.search("title='" + projectId + "'", function (err, res) {
      if (res.items.length) {
        self.projectFolder = res.items[0];
        self.save(projectId, filename, data);
      } else {
        self.createFolder(projectId, function (err, res) {
          if (err) {
            console.log(err);
            return false;
          }
          self.projectFolder = res;
          self.save(projectId, filename, data);
        });
      }
    });
  } else {
    var query = _.template("title='<%= filename %>' and '<%= projectFolder.id %>' in parents");
    this.search(query({ filename: filename, projectFolder: this.projectFolder }), function (err, res) {
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
              { id: self.projectFolder.id }
            ] })
          }).execute(function (resp) {
            self.showMessage('Code saved to Google Drive folder ' + self.projectId);
          });
        });
      } else {
        var request = gapi.client.request({
          method: 'PATCH',
          'path': '/drive/v2/files/' + res.items[0].id,
          'body': JSON.stringify({ title: filename, parents: [
            { id: self.projectFolder.id }
          ] })
        }).execute(function (resp) {
          self.showMessage('Code saved to Google Drive folder ' + self.projectId);
        });
      }
    });
  }
};

/**
 * Handler method for XHR complete
 * @param obj
 * @param data
 * @returns {boolean}
 */
Drive4Addons.prototype.onReadyStateChangeComplete = function(xhr, data) {
  if (xhr.responseText.indexOf('//OK') < 0) {
    return true;
  }
  var pieces = data.split('|');
  if (pieces.length != 23) {
    return true;
  }
  this.projectId = pieces[4];
  var filename = pieces[8];
  var body = pieces[10];

  return this.save(this.projectId, filename, body);
};

console.log('Drive for Add-ons loaded successfully');

var drive = new Drive4Addons({
  clientId: '487044269291-suaq47gvp6kbn2rifg24t17paft5mcul.apps.googleusercontent.com',
  apiKey: 'AIzaSyBSW3RekeJ05IqjoG6k0igNO9QPBh5Afww',
  scopes: 'https://www.googleapis.com/auth/plus.me https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file'
});

/**
 * The following code was borrowed and modified with infinite gratitude from:
 * https://gist.github.com/suprememoocow/2823600
 *
 */
(function (XHR, drive) {

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
  }
})(XMLHttpRequest, drive);




