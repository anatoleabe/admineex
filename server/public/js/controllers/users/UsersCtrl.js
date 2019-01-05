angular.module('UsersCtrl', []).controller('UsersController', ['$scope', '$state', 'gettextCatalog', '$ocLazyLoad', '$injector', '$mdDialog', '$rootScope', function($scope, $state, gettextCatalog, $ocLazyLoad, $injector, $mdDialog, $rootScope) {
    $ocLazyLoad.load('js/services/UserService.js').then(function() {
        var User = $injector.get('User');
        var helper = {
            title: gettextCatalog.getString("No user"),
            icon: "supervisor_account"
        };

        var helperNA = {
            title: gettextCatalog.getString("No pending account")
        };
        var helperA = {
            title: gettextCatalog.getString("No active account")
        };
        $scope.users = [], $scope.helper = [];

        $scope.edit = function (params) {
            $state.go("home.users.edit", params);
        };

        $scope.filterNotActivated = function (item) { 
            return item.activationToken !== '0'; 
        };

        $scope.filterActivated = function (item) { 
            return item.activationToken === '0'; 
        };

        function getUsers(){
            $scope.helper = [];
            $scope.helperNA = [];
            $scope.helperA = [];
            User.list().then(function(response){
                var data = response.data;
                if(data.length == 0 && $scope.helper.length == 0){
                    $scope.helper = helper;
                } else {
                    var na = 0, a = 0;
                    for(i=0;i<data.length;i++){
                        if(data[i].activationToken === '0'){
                            a++;
                        } else {
                            na++;
                        }
                    }
                    if(a == 0 && $scope.helperA.length == 0){
                        $scope.helperA = helperA;
                    }
                    if(na == 0 && $scope.helperNA.length == 0){
                        $scope.helperNA = helperNA;
                    }

                }
                $rootScope.kernel.loading = 100;
                $scope.users = data;
            }).catch(function(response) {
                console.log(response);
            });
        }
        getUsers();

        function deleteUser(id){
            User.delete({
                id : id
            }).then(function(response){
                getUsers();
                $rootScope.kernel.alerts.push({
                    type: 3,
                    msg: gettextCatalog.getString('The user has been deleted'),
                    priority: 4
                });
            }).catch(function(response) {
                console.log(response);
            });
        }

        $scope.activate = function(user){
            $rootScope.kernel.loading = 0;
            user.activationToken = "0";
            User.update(
                user
            ).then(function(response){
                $rootScope.kernel.loading = 100;
                $rootScope.kernel.alerts.push({
                    type: 3,
                    msg: gettextCatalog.getString('The user has been activated'),
                    priority: 4
                });
                getUsers()
            }).catch(function(response) {
                $rootScope.kernel.loading = 100;
                $rootScope.kernel.alerts.push({
                    type: 1,
                    msg: gettextCatalog.getString('An error occurred, please try again later'),
                    priority: 2
                });
            });
        }


        $scope.showConfirm = function(user){
            var confirm = $mdDialog.confirm()
            .title(gettextCatalog.getString("Delete this account"))
            .textContent(gettextCatalog.getString("Are you sure you want to delete the account of") + " " + user.firstname + " " + user.lastname + gettextCatalog.getString("?"))
            .ok(gettextCatalog.getString("Delete"))
            .cancel(gettextCatalog.getString("Cancel"));

            $mdDialog.show(confirm).then(function() {
                // Delete
                deleteUser(user._id)
            }, function() {
                // Cancel
            });
        }
    });
}]);
