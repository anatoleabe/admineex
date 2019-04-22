angular.module('StaffCtrl', []).controller('StaffController', function($scope, $window, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location) {
    $rootScope.kernel.loading = 0;
    $scope.title = "...";

    $ocLazyLoad.load('js/services/DictionaryService.js').then(function() {
        var Dictionary = $injector.get('Dictionary');
        Dictionary.jsonList({dictionary: 'project', levels: ['countries']}).then(function (response) {
            console.log(response);
            $scope.countriesList = response.data.jsonList;
            $ocLazyLoad.load('js/services/UserService.js').then(function() {
                var User = $injector.get('User');
               
            });
        }).catch(function(response) {
            console.error(response);
        });
    });
});
