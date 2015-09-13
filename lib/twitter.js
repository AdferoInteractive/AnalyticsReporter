var async = require('async');
var unshortener = require('unshortener');
var querystring = require('querystring');
var oauth = require('./oauth');

exports.getUserTweets = function(data,start,end,done) {
  var allTweets = [];
  var finish = function() {
    var tweets = allTweets.filter(function(tweet) {
      var time = new Date(tweet.created_at);
      return time.getTime() >= start.getTime() && time.getTime() <= end.getTime();
    });
    async.each(
      tweets,
      function(tweet,eachCallback) {
        if (tweet.entities && tweet.entities.urls) {
          async.map(
            tweet.entities.urls,
            function(url,mapCallback) {
              unshortener.expand(
                url.expanded_url,
                function (err, url) {
                  if (err) {
                    mapCallback(err,url);
                  } else {
                    mapCallback(null,url)
                  }
                }
              )
            },
            function(err,urls) {
              if (err) {
                console.warn(err);
              }
              if (urls) {
                tweet.urls = urls;
              }
              eachCallback();
            }
          );
        } else {
          eachCallback();
        }
      },
      function(err) {
        done(err,tweets);
      }
    );
  }
  var doFetch = function(max_id) {
    var params = {
      'count': 200
    }
    if (max_id) {
      params.max_id = max_id;
    }
    var url = 'https://api.twitter.com/1.1/statuses/user_timeline.json?' + querystring.stringify(params);
    oauth.twitterOAuth().get(url,data.auth.twitter.token,data.auth.twitter.secret,function(err,body) {
      if (err) {
        done(err);
      } else {
        var data = JSON.parse(body);
        if (data && data.length) {
          allTweets = allTweets.concat(data);
          if (data.length > 0) {
            var lastTweet = data[data.length - 1];
            var lastTweetTime = new Date(lastTweet.created_at);
            if (lastTweetTime.getTime() > start.getTime()) {
              return doFetch(lastTweet.id_str);
            }
          }
        }
        finish();
      }
    });     
  }
  doFetch(null);
}