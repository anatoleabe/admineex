angular.module('SigninCtrl', []).controller('SigninController', function($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $stateParams, $mdToast, $mdDialog) {    
    $scope.loading = false;
    $ocLazyLoad.load('js/services/AccountService.js').then(function() {
        var Account = $injector.get('Account');
        
        if($window.localStorage.token){
            $state.transitionTo('home.dashboard.main');
        }

        // If the user came from reset password state
        if($stateParams.isResetted && $stateParams.email){
            $mdDialog.show(
                $mdDialog.alert()
                .clickOutsideToClose(true)
                .title(gettextCatalog.getString("Password resetted"))
                .content(gettextCatalog.getString("Your password has been changed with success. You can now sign in."))
                .ariaLabel(gettextCatalog.getString("Password"))
                .ok(gettextCatalog.getString('Got it!'))
            ).finally(function(){
                $scope.email = $stateParams.email;
                $rootScope.setFocus('password');
                $stateParams.isResetted = null;
                $stateParams.email = null;
            });
        }

        // If the user came from lost password page
        if($stateParams.isLost){
            $mdDialog.show(
                $mdDialog.alert()
                .clickOutsideToClose(true)
                .title(gettextCatalog.getString("Reset password"))
                .content(gettextCatalog.getString("An email has been sent to your email address that includes a password reset link."))
                .ariaLabel(gettextCatalog.getString("Password"))
                .ok(gettextCatalog.getString('Got it!'))
            ).finally(function(){
                $stateParams.isLost = null;
            });
        }

        $scope.signin = function signin() {
            if ($scope.email !== undefined && $scope.password !== undefined) {
                $scope.loading = true;
                Account.signin({
                    email: $scope.email,
                    password: $scope.password,
                    rememberme: $scope.rememberme
                }).then(function(response) {
                    var data = response.data;
                    if(data.activated){
                        $window.localStorage.language = data.language;
                        $window.localStorage.token = data.token;
                        $state.transitionTo('home.dashboard.main');
                    } else {
                        $mdToast.show(
                            $mdToast.simple()
                            .textContent(gettextCatalog.getString('Account not activated'))
                            .position('top left right')
                            .hideDelay(3000)
                        );
                    }
                    $scope.loading = false;
                }).catch(function(response) {
                    $scope.loading = false;
                    $scope.password = "";
                    if(response.status === 401){
                        $mdToast.show(
                            $mdToast.simple()
                            .textContent(gettextCatalog.getString('The email or password you entered is incorrect.'))
                            .position('top left right')
                            .hideDelay(3000)
                        );
                    } else {
                        $mdToast.show(
                            $mdToast.simple()
                            .textContent(status)
                            .position('top right')
                            .hideDelay(3000)
                        );
                    }
                });
            } else {
                $mdToast.show(
                    $mdToast.simple()
                    .textContent(gettextCatalog.getString('The email or password is empty.'))
                    .position('top left right')
                    .hideDelay(3000)
                );
            }
        }
    });
});
