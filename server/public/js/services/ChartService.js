angular.module('ChartService', []).factory('Chart', function ($http) {
    return {
        build: function (config) {
            return $http.get('/api/charts/' + config.name 
                    + '/from/' + config.from 
                    + '/to/' + config.to 
                    + '/selectedUser/' + ((config.globalView && config.globalView.activated == true && config.globalView.selectedUser != undefined ) ? config.globalView.selectedUser:'undefined') 
            );
        }
    }
});