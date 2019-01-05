angular.module('ResetCtrl', []).controller('ResetController', function($scope, gettextCatalog, $ocLazyLoad, $injector, $stateParams, $state, $mdToast) {
    $ocLazyLoad.load('js/services/AccountService.js').then(function() {
        $scope.loading = false;
        var Account = $injector.get('Account');
        $scope.submit = function() {
            $scope.loading = true;
            Account.resetPassword({
                token: $stateParams.token,
                newPassword: $scope.newPassword,
                newPasswordConfirmation: $scope.newPasswordConfirmation
            }).then(function(response) {
                var data = response.data;
                $scope.loading = false;
                if(!data.token){
                    $scope.newPassword = "";
                    $scope.newPasswordConfirmation = "";
                    $mdToast.show(
                        $mdToast.simple()
                        .textContent(gettextCatalog.getString('The link has expired'))
                        .position('top left right')
                        .hideDelay(3000)
                    );
                } else {
                    if(!data.changed){
                        $scope.newPassword = "";
                        $scope.newPasswordConfirmation = "";
                        $mdToast.show(
                            $mdToast.simple()
                            .textContent(gettextCatalog.getString('Fill out the form correctly'))
                            .position('top left right')
                            .hideDelay(3000)
                        );
                    } else {
                        $state.go("signin", {"isResetted": true, "email": data.email});
                    }
                }
            }).catch(function(response) {
                $scope.newPassword = "";
                $scope.newPasswordConfirmation = "";
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
