angular.module('LostCtrl', []).controller('LostController', function($scope, gettextCatalog, $ocLazyLoad, $injector, $state, $mdToast) {
    $ocLazyLoad.load('js/services/AccountService.js').then(function() {
        $scope.loading = false;
        var Account = $injector.get('Account');
        $scope.submit = function() {
            $scope.loading = true;
            Account.lostPassword({
                email: $scope.email
            }).then(function(response) {
                var data = response.data;
                $scope.loading = false;
                if(!data.exists){
                    $mdToast.show(
                        $mdToast.simple()
                        .textContent(gettextCatalog.getString('No account found with that email address'))
                        .position('top left right')
                        .hideDelay(3000)
                    );
                } else {
                    $state.go("signin", {"isLost": true});
                }
            }).catch(function(response) {
                $scope.loading = false;
                $mdToast.show(
                    $mdToast.simple()
                    .textContent(gettextCatalog.getString('An error occurred, please try again later'))
                    .position('top left right')
                    .hideDelay(3000)
                );
            });
        }
    });
});
