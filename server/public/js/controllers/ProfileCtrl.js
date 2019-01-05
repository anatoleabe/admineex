angular.module('ProfileCtrl', []).controller('ProfileController', function ($scope, gettextCatalog, $location, $timeout, $state, $ocLazyLoad, $injector, $filter, $rootScope) {

    $ocLazyLoad.load('js/services/AccountService.js').then(function () {
        var Account = $injector.get('Account');

        //Get user profile
        Account.read().then(function (response) {
            var data = response.data;

            $rootScope.kernel.loading = 100;
            $scope.profile = data;

            //console.log($scope.profile);
        }).catch(function (response) {
            console.log(response);
        });

        $scope.update = function () {        
            Account.update({
                firstname: $scope.profile.firstname,
                lastname: $scope.profile.lastname,
                phone: $scope.profile.phone,
                email: $scope.profile.email
            }).then(function (response) {
                $state.go("home.profile.main", {}, {
                    reload: true
                });
            }).catch(function (response) {
                console.log(response);
            });
        };
    });
});
