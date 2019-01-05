var log             = require('../utils/log');
var jsonwebtoken    = require('jsonwebtoken');

// Controllers
var controllers = {
    configuration: require('../controllers/configuration.js'),
    revokedTokens: require('../controllers/revokedTokens.js')
};

var tokenConfig             = controllers.configuration.getConf().token;
var TOKEN_EXPIRATION        = Number(tokenConfig.expiration);
var GRACE_PERIOD            = 10;
var tokenSecret             = tokenConfig.secret;

exports.verifyToken = function (req, res, next) {
    var token = getToken(req.headers);
    controllers.revokedTokens.get(token, function (err, reply) {
        if (err) {
            log.error(err);
            return res.sendStatus(500);
        } else {
            var decoded = jsonwebtoken.decode(token);
            var remainingTime = -(Math.floor(new Date().getTime()/1000) - decoded.exp);
            // keep sending blank tokens even if there is no new token to send. This clears the client-side cached token, otherwise,
            // the client will beleive it receives a new token every time a 304 response is sent, containing an old "new" Authorization field.
            // I did not find an easy way to distinguish 304 responses from the 200 ones in angular's interceptor, and the headers are repeated.
            // I use 'c' instead of an empty string because Firefox doesn't not provide the Authorization field if it is empty
            res.set('Authorization', 'c');
            if (reply === undefined) {
                log.warn('Expired token found');
                return res.sendStatus(401);
            } else if (reply !== null ) {
                var repliedExpirationDate = reply.getTime();
                if (isNaN(repliedExpirationDate)) {
                    log.error('VerifyToken: error parsing the token expiration date');
                    return res.sendStatus(500);
                } else {
                    var remainingGracePeriodTime = repliedExpirationDate + GRACE_PERIOD*1000 - (new Date().getTime());
                    if (remainingGracePeriodTime > 0) {
                        return next();
                    } else {
                        log.error('Token error: remainingGracePeriodTime = ' + remainingGracePeriodTime);
                        return res.sendStatus(401);
                    }
                }
            } else { //reply===null
                if  (remainingTime < TOKEN_EXPIRATION *2/3) {
                    expireToken(token, true);
                    var newToken = jsonwebtoken.sign({id: decoded.id}, tokenSecret, { expiresIn: TOKEN_EXPIRATION });
                    log.info('Created token at ' + Math.floor(new Date().getTime()/1000) + ' ' + JSON.stringify(jsonwebtoken.decode(newToken)));
                    res.set('Authorization', 'Bearer ' + newToken);
                }
                return next();
            }
        }
    });
};


// the revoked token are stored in revokedTokens,
// if the token was not limited in time : we keep it forever, an empty ttl is associated to it,
// if the token was     limited in time and is NOT revoked in a "refresh token" process :
//                                      - expiration is set to the token's intrinsic remaining time plus an error margin
//                                      - an empty string is associated to it, 
// if the token was     limited in time and is     revoked in a "refresh token" process : 
//                                      - expiration is set to the token's intrinsic remaining time plus an error margin 
//                                      - we write the current timestamp into revokedTokens, so that we can choose to grant access to the other parallel
//                                        requests which are still using that token (a 10 seconds grace period should be far enough)
var expireToken = function(token, keepTenSeconds) {
    var decoded = jsonwebtoken.decode(token);
    var remainingTime = - (Date.now()/1000 - decoded.exp);
    var expiration = "";
    // if the token is not limited in time, keep the token forever
    if (remainingTime < 31536000) { // assuming TOKEN_EXPIRATION will never be larger than one year, 365*24*60*60=31536000
        expiration = Math.floor(remainingTime + 120);// keep a little longer than the normal remaining lifetime
        if (keepTenSeconds === true) {
            expiration += new Date().getTime() + GRACE_PERIOD*1000; // allow 10 more seconds
        }
    }
    controllers.revokedTokens.set(token, expiration);
};

var getToken = function(headers) {
    if (headers && headers.authorization) {
        var authorization = headers.authorization;
        var part = authorization.split(' ');
        if (part.length === 2) {
            return part[1];
        } else {
            return null;
        }
    } else {
        return null;
    }
};

exports.getToken = getToken;
exports.expireToken = expireToken;
exports.TOKEN_EXPIRATION = TOKEN_EXPIRATION;