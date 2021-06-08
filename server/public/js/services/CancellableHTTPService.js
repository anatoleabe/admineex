angular.module('CancellableHTTPService', []).factory('CancellableHTTP', ['$http', '$q', 'PendingRequest', function($http, $q, PendingRequest){
    return{
        get:function(url, more) {
            var canceller = $q.defer();
            PendingRequest.add({
                url: url,
                canceller: canceller
            });
            //Request gets cancelled if the timeout-promise is resolved
            var requestPromise;
            if(more === undefined){
                requestPromise = $http.get(url, { timeout: canceller.promise });
            } else {
                more.timeout = canceller.promise;
                requestPromise = $http(more);
            }
            //Once a request has failed or succeeded, remove it from the pending list
            requestPromise.finally(function() {
                PendingRequest.remove(url);
            });
            return requestPromise;
        }
    }
}]);