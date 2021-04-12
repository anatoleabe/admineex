angular.module('TasksCtrl', []).controller('TasksController', function ($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $mdDialog, $rootScope) {
    $ocLazyLoad.load('js/services/OrganizationService.js').then(function () {
        var Organization = $injector.get('Organization');
        var helper = {
            title: gettextCatalog.getString("No task"),
            icon: "account_balance"
        };

        $scope.tasks = [], $scope.helper = [];

        $scope.edit = function (params) {
            $state.go("home.tasks.edit", params);
        };

        function getTasks() {
            $scope.helper = [];
            Organization.list().then(function (response) {
                var data = response.data;
                if (data.length == 0 && $scope.helper.length == 0) {
                    $scope.helper = helper;
                }
                $rootScope.kernel.loading = 100;
                $scope.tasks = data;
            }).catch(function (response) {
                console.error(response);
            });
        }
        getTasks();


        function deleteOrganization(id) {
            Organization.delete({
                id: id
            }).then(function (response) {
                getTasks();
                $rootScope.kernel.alerts.push({
                    type: 3,
                    msg: gettextCatalog.getString('The task has been deleted'),
                    priority: 4
                });
            }).catch(function (response) {
                console.error(response);
            });
        }

        $scope.showConfirm = function (task) {
            var confirm = $mdDialog.confirm()
                    .title(gettextCatalog.getString("Delete this task"))
                    .textContent(gettextCatalog.getString("Are you sure you want to delete the task") + " " + task.name + gettextCatalog.getString("?"))
                    .ok(gettextCatalog.getString("OK"))
                    .cancel(gettextCatalog.getString("Cancel"));

            $mdDialog.show(confirm).then(function () {
                // Delete
                deleteOrganization(task._id)
            }, function () {
                // Cancel
            });
        }


        $scope.toppings = [
            {name: 'Pepperoni', wanted: true},
            {name: 'Sausage', wanted: false},
            {name: 'Black Olives', wanted: true},
            {name: 'Green Peppers', wanted: false}
        ];

        $scope.settings = [
            {name: 'Wi-Fi', extraScreen: 'Wi-Fi menu', icon: 'device:network-wifi', enabled: true},
            {name: 'Bluetooth', extraScreen: 'Bluetooth menu', icon: 'device:bluetooth', enabled: false},
        ];

        $scope.messages = [
            {id: 1, title: "Message A", selected: false},
            {id: 2, title: "Message B", selected: true},
            {id: 3, title: "Message C", selected: true},
        ];

        $scope.people = [
            {name: 'Janet Perkins', img: 'img/100-0.jpeg', newMessage: true},
            {name: 'Mary Johnson', img: 'img/100-1.jpeg', newMessage: false},
            {name: 'Peter Carlsson', img: 'img/100-2.jpeg', newMessage: false}
        ];

        $scope.goToPerson = function (person, event) {
            $mdDialog.show(
                    $mdDialog.alert()
                    .title('Navigating')
                    .textContent('Inspect ' + person)
                    .ariaLabel('Person inspect demo')
                    .ok('Neat!')
                    .targetEvent(event)
                    );
        };

        $scope.navigateTo = function (to, event) {
            $mdDialog.show(
                    $mdDialog.alert()
                    .title('Navigating')
                    .textContent('Imagine being taken to ' + to)
                    .ariaLabel('Navigation demo')
                    .ok('Neat!')
                    .targetEvent(event)
                    );
        };

        $scope.doPrimaryAction = function (event) {
            $mdDialog.show(
                    $mdDialog.alert()
                    .title('Primary Action')
                    .textContent('Primary actions can be used for one click actions')
                    .ariaLabel('Primary click demo')
                    .ok('Awesome!')
                    .targetEvent(event)
                    );
        };

        $scope.doSecondaryAction = function (event) {
            $mdDialog.show(
                    $mdDialog.alert()
                    .title('Secondary Action')
                    .textContent('Secondary actions can be used for one click actions')
                    .ariaLabel('Secondary click demo')
                    .ok('Neat!')
                    .targetEvent(event)
                    );
        };
    });
});
