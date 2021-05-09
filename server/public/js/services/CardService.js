angular.module('CardService', []).factory('Card', ['CancellableHTTP', function(CancellableHTTP) {
    return {
        build: function(config) {
            return CancellableHTTP.get('/api/cards/' + config.name + '/from/' + config.from + '/to/' + config.to + '/laboratories/' + ((config.laboratories!=undefined && config.laboratories.length > 0) ? config.laboratories:'undefined') + '/disease/' + config.disease + '/theme/' + config.theme + '/testType/' + config.testType + '/diagnostic/' + config.diagnostic + '/group/' + config.group);
        }
    }
}]);