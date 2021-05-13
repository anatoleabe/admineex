angular.module('PendingRequestService', []).factory('PendingRequest', [function() {
    var pending = [];
    return {
        remove: function(request) {
            var toReturn = [];
            for(var i=0;i<pending.length;i++){
                if(pending[i].url !== request){
                    toReturn.push(pending[i])
                }
            }
            pending = toReturn;
        },
        cancelAll: function() {
            angular.forEach(pending, function(p) {
                console.log("Cancel HTTP request: ", p.url);
                p.canceller.resolve();
            });
            pending.length = 0;},
        add: function(request) {
            pending.push(request);
        },
        get: function() {
            return pending;
        }
    }
}]);