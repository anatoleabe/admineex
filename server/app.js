var fs              = require('fs');
var express         = require('express');
var helmet          = require('helmet');
var methodOverride  = require('method-override');
var bodyParser      = require('body-parser');
var favicon         = require('serve-favicon');
var nconf           = require('nconf');
var randtoken       = require('rand-token').uid;
var app             = express();
var server          = require('http').Server(app);

nconf.file('config/server.json');

nconf.load(function (err, result) {
    if (err) {
        console.log('Error : could not load the config file');
    } else {
        function setDefault(key, defaultValue) {
            if (typeof nconf.get(key) === 'undefined') {
                nconf.set(key, defaultValue);
                return true;
            }
            else return false;
        }
        var changed = false;

        // provide default configuration values :
        //System
        changed |= setDefault("system:logPath", "../logs/");
        changed |= setDefault("system:deleteLogsAfter", "-1");
        changed |= setDefault("system:environment", "dev");

        //Server
        changed |= setDefault("server:name", "http://persabe.org");
        changed |= setDefault("server:host", "127.0.0.1");
        changed |= setDefault("server:httpPort", 4001);

        //Token
        changed |= setDefault("token:secret", randtoken(50));
        changed |= setDefault("token:expiration", 900);

        //MongoDB
        changed |= setDefault("mongo", "mongodb://127.0.0.1:27017/persabe");

        //Mailer
        changed |= setDefault("mailer:host", "smtp.gmail.com");
        changed |= setDefault("mailer:port", 465);
        changed |= setDefault("mailer:auth:user", "anatoleabe@gmail.com");
        changed |= setDefault("mailer:auth:pass", "ylpeR6102oN");
        changed |= setDefault("mailer:sender:name", "Persabe");
        changed |= setDefault("mailer:sender:address", "anatoleabe@gmail.com");
        
        //Rate limiter
        changed |= setDefault("rateLimiter:points", 200);
        changed |= setDefault("rateLimiter:duration", 1);
        changed |= setDefault("rateLimiter:blockDuration", 60);
        
        //model initialization from json
        changed |= setDefault("initialize:structures", 0);//0 = not done, 1 = done
        changed |= setDefault("initialize:positions", 0);//0 = not done, 1 = done

        // write the config changes to disk and run the server
        if (changed) {
            nconf.save(function (err) {
                if (err) {
                    console.log("Could not write to the configuration file ("+err+")");
                } else {
                    console.log('The configuration file has been created/updated');
                    main();
                }
            });
        } else {
            main();
        }
    }
});


function main() {
    // this must be called BEFORE require('./app/log/log') and
    // AND                 AFTER  the configuration is completely loaded
    require('./app/databases/mongodb');

    //the log system needs the log path to be known, the nconf must be properly setup
    var log   = require('./app/utils/log');
    var audit = require('./app/utils/audit-log');

    // Audit-log
    audit.addTransport("mongoose", {connectionString: nconf.get('mongo'), debug:false});

    // Rate limiter by key and protection from DDoS and brute force attacks
    var rateLimiterFlexible = require('rate-limiter-flexible');
    var rateLimiter = new rateLimiterFlexible.RateLimiterMemory({
        points: nconf.get('rateLimiter').points, // Points
        duration: nconf.get('rateLimiter').duration, // Per second
        blockDuration: nconf.get('rateLimiter').blockDuration, // block for x seconds if more than points consumed 
    });
    var rateLimiterMiddleware = (req, res, next) => {
        // Consume 1 point for each request
        rateLimiter.consume(req.connection.remoteAddress).then(function() {
            next();
        }).catch(function(rejRes){
            res.status(429).send('Too Many Requests');
        });
    };
    app.use(rateLimiterMiddleware);
    
    // Express 4 config
    app.use(helmet());
    app.use(express.static(__dirname + '/public'));
    app.use(favicon(__dirname + '/public/img/logos/favicon.ico'));
    app.use(methodOverride());

    // MongoDB
    require('./app/databases/mongodb');

    // Routes
    require('./app/routes')(app);

    // Start server
    server.listen(nconf.get('server').httpPort);

    // Log
    log.info('Persabe started on port ' + nconf.get('server').httpPort);
    audit.logEvent('[app]', 'main app', 'Start', 'Port', nconf.get('server').httpPort, 'succeed', 'Server successfully started.');   
}

exports = module.exports = app;
