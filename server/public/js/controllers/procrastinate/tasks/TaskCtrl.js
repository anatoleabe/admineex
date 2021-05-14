angular.module('TaskCtrl', []).controller('TaskController', function ($scope, $window, gettextCatalog, $q, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location) {
    $rootScope.kernel.loading = 0;
    $scope.title = "...";
    $scope.task = {};
    var users = {};
    $scope.selectedUsers = [];
    $scope.uploader = {};

    $scope.priorities = [
        {name: 'None', id: '1'},
        {name: 'Low', id: '2'},
        {name: 'Medium', id: '3'},
        {name: 'High', id: '4'}
    ];

    $scope.myFilter = function (item) {
        return item.selected;
    };

    $ocLazyLoad.load('node_modules/ng-file-upload/dist/ng-file-upload.min.js').then(function () {
        var Upload = $injector.get('Upload');
        $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
            var Dictionary = $injector.get('Dictionary');

            Dictionary.jsonList({dictionary: 'task', levels: ['statuses']}).then(function (response) {
                $scope.progress = response.data.jsonList;
                $scope.progress.sort(sortIt("id"));
                function sortIt(prop) {
                    return function (a, b) {
                        if (a[prop] > b[prop]) {
                            return 1;
                        } else if (a[prop] < b[prop]) {
                            return -1;
                        }
                        return 0;
                    }
                }

                $ocLazyLoad.load('js/services/UserService.js').then(function () {
                    var User = $injector.get('User');
                    User.list().then(function (response) {
                        $scope.users = response.data;
                        users = response.data;
                        $ocLazyLoad.load('js/services/TaskService.js').then(function () {
                            var Task = $injector.get('Task');
                            $ocLazyLoad.load('js/services/CategoryService.js').then(function () {
                                var Category = $injector.get('Category');
                                Category.list().then(function (response) {
                                    var data = response.data;
                                    $rootScope.kernel.loading = 100;
                                    $scope.categories = data;
                                }).catch(function (response) {
                                    console.error(response);
                                });



                                $scope.querySearchInUsersList = function (text) {
                                    var deferred = $q.defer();
                                    if (text) {
                                        var user = $.grep(users, function (c, i) {
                                            var fullName = c.firstname + " " + c.lastname;
                                            return fullName.toLowerCase().includes(text.toLowerCase());
                                        });
                                        deferred.resolve(user);
                                    } else {
                                        deferred.resolve(users);
                                    }
                                    return deferred.promise;
                                }

                                $scope.transformChip = function (chip) {
                                    if (angular.isObject(chip)) {
                                        return chip;
                                    }
                                    return null;
                                }

                                function prepareDetailsForServer() {
                                    if ($scope.task) {
                                        var selectedUsers = [];
                                        if ($scope.selectedUsers && $scope.selectedUsers.length > 0) {
                                            for (i = 0; i < $scope.selectedUsers.length; i++) {
                                                if ($scope.selectedUsers[i]) {
                                                    selectedUsers.push($scope.selectedUsers[i]);
                                                }
                                            }
                                        }
                                        $scope.task.usersID = JSON.stringify(selectedUsers);
                                    }
                                }

                                var watch = {};
                                watch.file = $scope.$watch('uploader.file', function (newval, oldval) {

                                    if (newval) {
                                        var initialName = newval.name;

                                        $scope.uploader.file.name = initialName;
                                    }
                                });
                                $scope.$on('$destroy', function () {// in case of destroy, we destroy the watch
                                    watch.file();
                                });

                                $scope.activeStatusOnly = function (item) {
                                    return item.id !== "5";
                                };


                                // Modify or Add ?
                                if ($stateParams.id !== undefined) {
                                    $scope.new = false;
                                    Task.readForEdit({
                                        id: $stateParams.id
                                    }).then(function (response) {
                                        $scope.task = response.data;
                                        $scope.selectedUsers = $scope.task.usersID;
                                        $scope.uploader.file = $scope.task.attachedFiles;
                                    }).catch(function (response) {
                                        $rootScope.kernel.alerts.push({
                                            type: 1,
                                            msg: gettextCatalog.getString('An error occurred, please try again later'),
                                            priority: 2
                                        });
                                        console.error(response);
                                    });

                                    // Modify an Task
                                    $scope.submit = function () {
                                        $rootScope.kernel.loading = 0;
                                        if ($scope.task.status != undefined && $scope.task.categoryID != undefined && $scope.task.priority != undefined && $scope.task.deadline != undefined && $scope.selectedUsers[0] != undefined) {
                                            prepareDetailsForServer();
                                            Upload.upload({
                                                url: '/api/tasks',
                                                file: $scope.uploader,
                                                fields: $scope.task,
                                                method: 'PUT',
                                                sendObjectsAsJsonBlob: true
                                            }).then(function (response) {
                                                $state.transitionTo('home.tasks.main');
                                                $rootScope.kernel.alerts.push({
                                                    type: 3,
                                                    msg: gettextCatalog.getString('The task has been updated'),
                                                    priority: 4
                                                });
                                                $rootScope.kernel.loading = 100;
                                            }).catch(function (response) {
                                                $rootScope.kernel.loading = 100;
                                                $rootScope.kernel.alerts.push({
                                                    type: 1,
                                                    msg: gettextCatalog.getString('An error occurred, please try again later'),
                                                    priority: 2
                                                });
                                                console.error(response);
                                            });
                                        } else {
                                            $rootScope.kernel.loading = 100;
                                            $rootScope.kernel.alerts.push({
                                                type: 2,
                                                msg: gettextCatalog.getString("Please fill all required fields"),
                                                priority: 3
                                            });
                                        }
                                    }
                                } else {
                                    $scope.new = true;
                                    $scope.title = gettextCatalog.getString('New');
                                    $scope.task.usersID = [];
                                    $scope.task.status = "1";

                                    // Add a new task
                                    $scope.submit = function () {
                                        console.log("jeeenen")
                                        $scope.loading = 0;
                                        if ($scope.task.status != undefined && $scope.task.categoryID != undefined && $scope.task.priority != undefined && $scope.task.deadline != undefined && $scope.selectedUsers[0] != undefined) {
                                            prepareDetailsForServer();

                                            Upload.upload({
                                                url: '/api/tasks',
                                                file: $scope.uploader,
                                                fields: $scope.task,
                                                method: 'PUT',
                                                sendObjectsAsJsonBlob: true
                                            }).then(function (response) {
                                                $scope.loading = 100;
                                                $state.transitionTo('home.tasks.main');
                                                $rootScope.kernel.alerts.push({
                                                    type: 3,
                                                    msg: gettextCatalog.getString('The task has been created'),
                                                    priority: 4
                                                });
                                            }).catch(function (response) {
                                                $scope.loading = 100;
                                                console.error(response);
                                                $rootScope.kernel.alerts.push({
                                                    type: 1,
                                                    msg: gettextCatalog.getString('An error occurred, please try again later'),
                                                    priority: 2
                                                });
                                            });
                                        } else {
                                            $rootScope.kernel.loading = 100;
                                            $rootScope.kernel.alerts.push({
                                                type: 2,
                                                msg: gettextCatalog.getString("Please fill all required fields"),
                                                priority: 3
                                            });
                                        }
                                    }
                                }
                            });
                        });
                    }).catch(function (response) {
                        console.error(response);
                    });
                });
            });
        });
    });
});
