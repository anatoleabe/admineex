angular.module('PersonnalRecordsCtrl', [[
        'node_modules/angular-timeline/dist/angular-timeline.css'
    ]]).controller('PersonnalRecordsController', function ($scope, $window, gettextCatalog, $q, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location, $mdDialog, $http, $filter, params) {
    var id = params && params.id ? params.id : $stateParams.id;
    var oldPath = params && params.opath ? params.name : $stateParams.opath;

    $rootScope.kernel.loading = 100;
    $scope.title = "...";

    $scope.loading = false;
    $scope.sending = false;
    $scope.search = false;

    $scope.personnels = [];
    $scope.personnelSelected = undefined;
    $scope.personnelSearchText = null;
    $scope.selectedPersonnelChange = null;
    $scope.profiles = [];
    $scope.kills = [];
    var dictionary = {};
    $scope.helperNoData = {
        icon: 'event_note',
        title: gettextCatalog.getString("No data found.")
    };


    $scope.helper = {
        icon: 'search',
        title: gettextCatalog.getString("Use input to search for a personnal record")
    };

    $scope.edit = function (params) {
        $state.go("home.staffs.edit", params);
    };

    $scope.currentTab = 0;

    $scope.selectTab = function (tab) {
        $scope.currentTab = tab;
        console.log(tab)
    };

    function sortMe(a, b) {
        return new Date(b.dateOf).getTime() - new Date(a.dateOf).getTime();
    }


    $ocLazyLoad.load('../node_modules/angular-base64/angular-base64.js').then(function () {

        $ocLazyLoad.load('js/services/StaffService.js').then(function () {
            var Staffs = $injector.get('Staff');
            $ocLazyLoad.load('js/services/DocumentService.js').then(function () {
                var Document = $injector.get('Document');
                $ocLazyLoad.load('js/services/AffectationService.js').then(function () {
                    var Affectation = $injector.get('Affectation');
                    $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
                        var Dictionary = $injector.get('Dictionary');
                        Dictionary.jsonList({dictionary: "personnel", levels: ['profile']}).then(function (response) {
                            dictionary.profiles = response.data.jsonList;
                            Dictionary.jsonList({dictionary: "personnel", levels: ['skills']}).then(function (response) {
                                dictionary.skills = response.data.jsonList;
                                Dictionary.jsonList({dictionary: "acts", levels: ['natures']}).then(function (response) {
                                    dictionary.natures = response.data.jsonList;


                                    $scope.pdf1 = function () {
                                        $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                                            var FileSaver = $injector.get('FileSaver');
                                            $rootScope.kernel.loading = 0;
                                            var deferred = $q.defer();
                                            $scope.promise = deferred.promise;
                                            $http({
                                                method: 'GET',
                                                url: '/api/pdf/pdf1/',
                                                headers: {'Content-Type': "application/pdf"},
                                                responseType: "arraybuffer"
                                            }).then(function (response) {
                                                var d = new Blob([response.data], {type: "application/pdf"});
                                                FileSaver.saveAs(d, 'CV_xxx.pdf');
                                                $rootScope.kernel.loading = 100;
                                                deferred.resolve(response.data);
                                            }).catch(function (response) {
                                                console.error(response);
                                            });
                                        });

                                    };


                                    function createFilterFor(query) {
                                        var lowercaseQuery = query.toLowerCase();
                                        return function filterFn(item) {
                                            return (item.value.indexOf(lowercaseQuery) === 0);
                                        };
                                    }

                                    function getDictionaryItemByValue(dictionaryList, itemValue) {
                                        var items = $.grep(dictionaryList, function (c, i) {
                                            return c.value === itemValue;
                                        });
                                        if (items && items.length > 0) {
                                            return items[0];
                                        } else {
                                            return undefined;
                                        }
                                    }

                                    //Patient Query search
                                    $scope.personnelQuerySearch = function (text) {
                                        $scope.personnelSelected = undefined;
                                        var deferred = $q.defer();
                                        var results = text ? createFilterFor(text) : deferred;
                                        Staffs.search({text: text}).then(function (response) {
                                            var result = response.data;
                                            if (!result || result === 'null' | result === null) {
                                                result = [];
                                            }
                                            deferred.resolve(result);
                                        }).catch(function (response) {
                                            console.log(response);
                                        });
                                        return deferred.promise;
                                    };

                                    function readStaff(query) {
                                        Staffs.read({
                                            id: id,
                                            beautify: true
                                        }).then(function (response) {
                                            $scope.selectedPersonnelChange(response.data);
                                            $scope.back = function () {
                                                $state.go(oldPath);
                                            };
                                        }).catch(function (response) {
                                            $rootScope.kernel.alerts.push({
                                                type: 1,
                                                msg: gettextCatalog.getString('An error occurred, please try again later'),
                                                priority: 2
                                            });
                                            console.error(response);
                                        });
                                    }

                                    if (id) {
                                        readStaff(id);
                                    }


                                    $scope.newSanction = function (personnel, type) {
                                        console.log(type)
                                        var form = "sanction.html";
                                        if (type === '3') {
                                            form = "award.html";
                                        }
                                        $ocLazyLoad.load('js/controllers/staffs/staff/SanctionCtrl.js').then(function () {
                                            $mdDialog.show({
                                                controller: 'SanctionController',
                                                templateUrl: '../templates/dialogs/' + form,
                                                parent: angular.element(document.body),
                                                clickOutsideToClose: true,
                                                locals: {
                                                    params: {
                                                        personnel: personnel,
                                                        type: type
                                                    }
                                                }
                                            }).then(function (answer) {
                                                readStaff(id);
                                                //Update the user sanctions after the update
                                                $scope.$broadcast('sanctionupdated', []);
                                            }, function () {
                                                readStaff(id);
                                            });
                                        });
                                    }


                                    $scope.newAffectation = function (personnel) {
                                        $ocLazyLoad.load('js/controllers/administration/positions/AffectationCtrl.js').then(function () {
                                            $mdDialog.show({
                                                controller: 'AffectationController',
                                                templateUrl: '../templates/dialogs/affectation.html',
                                                parent: angular.element(document.body),
                                                clickOutsideToClose: true,
                                                locals: {
                                                    params: {
                                                        personnel: personnel
                                                    }
                                                }
                                            }).then(function (answer) {
                                            }, function () {
                                            });
                                        });
                                    };

                                    $scope.newStaffSituation = function (personnel) {
                                        $ocLazyLoad.load('js/controllers/staffs/staff/SituationCtrl.js').then(function () {
                                            $mdDialog.show({
                                                controller: 'SituationController',
                                                templateUrl: '../templates/dialogs/situation.html',
                                                parent: angular.element(document.body),
                                                clickOutsideToClose: true,
                                                locals: {
                                                    params: {
                                                        personnel: personnel
                                                    }
                                                }
                                            }).then(function (answer) {
                                            }, function () {
                                            });
                                        });
                                    }


                                    $scope.selectedPersonnelChange = function (personnel) {
                                        if (personnel) {
                                            $scope.personnelSelected = personnel;
                                            $rootScope.selectedPersonnelId = personnel._id;
                                            loadsHistory();
                                            loadsDocuments();



                                            $scope.userImage = "templates/staffs/img/" + personnel.mysqlId + ".jpeg";
                                            if (personnel.mysqlId != "351" && personnel.mysqlId != "372" && personnel.mysqlId != "97") {
                                                $scope.userImage = "templates/staffs/img/unknow.png";
                                            }

                                            function prepareRequiredItemsToAngular() {
                                                var profiles = [];
                                                var skills = [];
                                                if ($scope.personnelSelected) {
                                                    if ($scope.personnelSelected.profiles) {
                                                        for (i = 0; i < $scope.personnelSelected.profiles.length; i++) {
                                                            if ($scope.personnelSelected.profiles [i]) {
                                                                profiles.push(getDictionaryItemByValue(dictionary.profiles, $scope.personnelSelected.profiles[i]));
                                                            }
                                                        }
                                                    }
                                                    if ($scope.personnelSelected.skills) {
                                                        for (i = 0; i < $scope.personnelSelected.skills.length; i++) {
                                                            if ($scope.personnelSelected.skills [i]) {
                                                                skills.push(getDictionaryItemByValue(dictionary.skills, $scope.personnelSelected.skills[i]));
                                                            }
                                                        }
                                                    }
                                                }
                                                $scope.profiles = profiles;
                                                $scope.skills = skills;
                                            }

                                            prepareRequiredItemsToAngular();

                                            $scope.add = function (personnel, moreField, resourcesDistionary) {
                                                var personnel = personnel;

                                                $mdDialog.show({
                                                    controller: ['$scope', '$mdDialog', 'personnel', '$q', 'dictionary', 'moreField', 'resourcesDistionary', function ($scope, $mdDialog, personnel, $q, dictionary, moreField, resourcesDistionary) {
                                                            $scope.personnel = personnel;
                                                            $scope.detailDescription = {};
                                                            $scope.detailDescription.name = resourcesDistionary;
                                                            if (resourcesDistionary == "profiles") {
                                                                $scope.detailDescription.title = gettextCatalog.getString("Select profiles (You can add up to 05 profiles):");
                                                                $scope.detailDescription.placeholder = gettextCatalog.getString("Choose profile");
                                                            } else if (resourcesDistionary == "skills") {
                                                                $scope.detailDescription.title = gettextCatalog.getString("Select skills (You can add up to 05 skills):");
                                                                $scope.detailDescription.placeholder = gettextCatalog.getString("Choose a skill");
                                                            }


                                                            function prepareDetailsForServer() {
                                                                if ($scope.personnel) {
                                                                    $scope.personnel[moreField] = [];
                                                                    for (i = 0; i < $scope.selectedDetails.length; i++) {
                                                                        if ($scope.selectedDetails[i]) {
                                                                            $scope.personnel[moreField].push($scope.selectedDetails[i].id);
                                                                        }
                                                                    }
                                                                }
                                                            }

                                                            function prepareDetailsForAngular() {
                                                                var requiredDetails = [];
                                                                if ($scope.personnel) {
                                                                    if ($scope.personnel[moreField]) {
                                                                        for (i = 0; i < $scope.personnel[moreField].length; i++) {
                                                                            if ($scope.personnel[moreField] [i]) {
                                                                                requiredDetails.push(getDictionaryItemByValue(dictionary[resourcesDistionary], $scope.personnel[moreField][i]));
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                                $scope.selectedDetails = requiredDetails;
                                                            }

                                                            prepareDetailsForAngular();

                                                            $scope.querySearchInProfiles = function (text) {
                                                                var deferred = $q.defer();
                                                                if (text) {
                                                                    var profile = $.grep(dictionary[resourcesDistionary], function (c, i) {
                                                                        return c.name.toLowerCase().includes(text.toLowerCase());
                                                                    });
                                                                    deferred.resolve(profile);
                                                                } else {
                                                                    deferred.resolve(dictionary[resourcesDistionary]);
                                                                }
                                                                return deferred.promise;
                                                            }

                                                            $scope.transformChip = function (chip) {
                                                                // If it is an object, it's already a known chip
                                                                if (angular.isObject(chip)) {
                                                                    return chip;
                                                                }
                                                                // Otherwise, return null;
                                                                return null;
                                                            }

                                                            ;
                                                            $scope.close = function () {
                                                                $mdDialog.hide();
                                                            }
                                                            $scope.cancel = function () {
                                                                $mdDialog.cancel();
                                                            };
                                                            $scope.save = function (params) {
                                                                $scope.personnel[moreField] = $scope.selectedDetails;

                                                                prepareDetailsForServer();

                                                                var positionToUpdate = {
                                                                    _id: $scope.personnel._id,
                                                                    identifier: $scope.personnel.identifier
                                                                };
                                                                positionToUpdate[moreField] = $scope.personnel[moreField];

                                                                Staffs.upsert(positionToUpdate).then(function (response) {
                                                                    $mdDialog.hide();
                                                                    prepareRequiredItemsToAngular();
                                                                    $rootScope.kernel.alerts.push({
                                                                        type: 3,
                                                                        msg: gettextCatalog.getString('The staff has been updated'),
                                                                        priority: 4
                                                                    });
                                                                }).catch(function (response) {
                                                                    $rootScope.kernel.loading = 100;
                                                                    $rootScope.kernel.alerts.push({
                                                                        type: 1,
                                                                        msg: gettextCatalog.getString('An error occurred, please try again later'),
                                                                        priority: 2
                                                                    });
                                                                });
                                                            };

                                                        }],
                                                    templateUrl: '../templates/dialogs/detail.html',
                                                    parent: angular.element(document.body),
                                                    clickOutsideToClose: true,
                                                    locals: {
                                                        personnel: personnel,
                                                        dictionary: dictionary,
                                                        moreField: moreField,
                                                        resourcesDistionary: resourcesDistionary
                                                    }
                                                }).then(function (answer) {

                                                }, function () {

                                                });
                                            }

                                        } else {
                                            $scope.personnelSelected = undefined;
                                            $scope.events = [];
                                        }
                                    }



                                    loadsHistory = function () {
                                        var deferred = $q.defer();
                                        $rootScope.kernel.loading = 0;
                                        $scope.helper = [];
                                        var limit = 0;
                                        var skip = 0;
                                        var filterParams = {}
                                        $scope.search = $scope.personnelSelected.identifier;
                                        Affectation.list({limit: limit, skip: skip, search: $scope.search, filters: JSON.stringify(filterParams)}).then(function (response) {
                                            var data = response.data;
                                            $rootScope.kernel.loading = 100;
                                            $scope.allAffectations = data;
                                            return deferred.promise;
                                        }).catch(function (response) {
                                            console.log(response);
                                        });
                                    }

                                    loadsDocuments = function () {
                                        var deferred = $q.defer();
                                        $rootScope.kernel.loading = 0;
                                        $scope.helper = [];
                                        var limit = 0;
                                        var skip = 0;
                                        var filterParams = {
                                            owner: undefined
                                        };
                                        Document.list({limit: limit, skip: skip, search: $scope.search, filters: JSON.stringify(filterParams)}).then(function (response) {
                                            var data = response.data;
                                            $rootScope.kernel.loading = 100;

                                            $scope.documents = {
                                                data: data,
                                                count: data.length
                                            };
                                            return deferred.promise;
                                        }).catch(function (response) {
                                            console.log(response);
                                        });

                                        $scope.new = function (p) {
                                            console.log(p)
                                            $ocLazyLoad.load('js/controllers/staffs/staff/PhysicalRecordCtrl.js').then(function () {
                                                $mdDialog.show({
                                                    controller: 'PhysicalRecordController',
                                                    templateUrl: '../templates/dialogs/physicalRecord.html',
                                                    parent: angular.element(document.body),
                                                    clickOutsideToClose: true,
                                                    locals: {
                                                        params: {
                                                            p: p
                                                        }
                                                    }
                                                }).then(function (answer) {
                                                    //$scope.getAffectations();
                                                }, function () {
                                                });
                                            });
                                        };

                                        $scope.edit = function (doc) {
                                            $ocLazyLoad.load('js/controllers/staffs/staff/PhysicalRecordCtrl.js').then(function () {
                                                $mdDialog.show({
                                                    controller: 'PhysicalRecordController',
                                                    templateUrl: '../templates/dialogs/physicalRecord.html',
                                                    parent: angular.element(document.body),
                                                    clickOutsideToClose: true,
                                                    locals: {
                                                        params: {
                                                            doc: doc
                                                        }
                                                    }
                                                }).then(function (answer) {
                                                    //$scope.getAffectations();
                                                }, function () {
                                                });
                                            });
                                        };

                                        $scope.showConfirm = function (document) {
                                            var confirm = $mdDialog.confirm()
                                                    .title(gettextCatalog.getString("Delete this document"))
                                                    .textContent(gettextCatalog.getString("Are you sure you want to delete this document") + " " + document.fileName + gettextCatalog.getString("?"))
                                                    .ok(gettextCatalog.getString("Delete"))
                                                    .cancel(gettextCatalog.getString("Cancel"));

                                            $mdDialog.show(confirm).then(function () {
                                                // Delete
                                                Document1.delete({
                                                    id: document._id
                                                }).then(function (response) {
                                                    $scope.getDocuments();
                                                    $rootScope.kernel.alerts.push({
                                                        type: 3,
                                                        msg: gettextCatalog.getString('The document has been deleted successfully'),
                                                        priority: 4
                                                    });
                                                }).catch(function (response) {
                                                    console.log(response);
                                                });
                                            }, function () {
                                                // Cancel
                                            });
                                        }


                                        $scope.download = function (document) {
                                            $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                                                var FileSaver = $injector.get('FileSaver');
                                                $rootScope.kernel.loading = 0;
                                                var deferred = $q.defer();
                                                $scope.promise = deferred.promise;
                                                function jsonBufferToObject(data, headersGetter, status) {
                                                    var type = headersGetter("Content-Type");
                                                    if (!type.startsWith("application/json")) {
                                                        return data;
                                                    }
                                                    ;
                                                    var decoder = new TextDecoder("utf-8");
                                                    var domString = decoder.decode(data);
                                                    var json = JSON.parse(domString);
                                                    return json;
                                                }

                                                $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                                                    var Download = $injector.get('Download');
                                                    Download.start({
                                                        method: 'GET',
                                                        url: '/api/documents/download/' + document._id,
                                                        headers: {'Content-Type': "blob"},
                                                        transformResponse: jsonBufferToObject
                                                    }).then(function (response) {
                                                        var d = new Blob([response.data]);
                                                        FileSaver.saveAs(d, document.fileName);
                                                        $rootScope.kernel.loading = 100;
                                                        deferred.resolve(response.data);
                                                    }).catch(function (response) {
                                                        console.error(response);
                                                        if (response.data && response.data.error === '9500') {
                                                            $rootScope.kernel.alerts.push({
                                                                type: 1,
                                                                msg: gettextCatalog.getString('The Export is too big. Please reduce the date range'),
                                                                priority: 1
                                                            });
                                                            $rootScope.kernel.loading = 100;
                                                        }
                                                    });
                                                });
                                            });
                                        }


                                        $scope.view = function (document) {
                                            $rootScope.kernel.loading = 0;
                                            var deferred = $q.defer();
                                            $scope.promise = deferred.promise;
                                            function jsonBufferToObject(data, headersGetter, status) {
                                                var type = headersGetter("Content-Type");
                                                if (!type.startsWith("application/json")) {
                                                    return data;
                                                }
                                                ;
                                                var decoder = new TextDecoder("utf-8");
                                                var domString = decoder.decode(data);
                                                var json = JSON.parse(domString);
                                                return json;
                                            }

                                            $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                                                var Download = $injector.get('Download');
                                                Download.start({
                                                    method: 'GET',
                                                    url: '/api/documents/download/' + document._id,
                                                    headers: {'Content-Type': "blob"},
                                                    transformResponse: jsonBufferToObject
                                                }).then(function (response) {
                                                    console.log("downloaded ====")
                                                    var d = new Blob([response.data]);
                                                    $scope.documentToView = d;
                                                    $rootScope.kernel.loading = 100;
                                                    deferred.resolve(response.data);
                                                }).catch(function (response) {
                                                    console.error(response);
                                                });
                                            });
                                        }

                                        $scope.zipAll = function (document) {
                                            console.log("zip", document)
                                            $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                                                var FileSaver = $injector.get('FileSaver');
                                                $rootScope.kernel.loading = 0;
                                                var deferred = $q.defer();
                                                $scope.promise = deferred.promise;
                                                function jsonBufferToObject(data, headersGetter, status) {
                                                    var type = headersGetter("Content-Type");
                                                    if (!type.startsWith("application/json")) {
                                                        return data;
                                                    }
                                                    ;
                                                    var decoder = new TextDecoder("utf-8");
                                                    var domString = decoder.decode(data);
                                                    var json = JSON.parse(domString);
                                                    return json;
                                                }

                                                $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                                                    var Download = $injector.get('Download');
                                                    Download.start({
                                                        method: 'GET',
                                                        url: '/api/documents/zip/' + $scope.personnelSelected._id,
                                                        headers: {'Content-Type': "application/zip"},
                                                        transformResponse: jsonBufferToObject
                                                    }).then(function (response) {
                                                        var d = new Blob([response.data]);
                                                        FileSaver.saveAs(d, $scope.personnelSelected._id + ".zip");
                                                        $rootScope.kernel.loading = 100;
                                                        deferred.resolve(response.data);
                                                    }).catch(function (response) {
                                                        console.error(response);
                                                        if (response.data && response.data.error === '9500') {
                                                            $rootScope.kernel.alerts.push({
                                                                type: 1,
                                                                msg: gettextCatalog.getString('The Export is too big. Please reduce the date range'),
                                                                priority: 1
                                                            });
                                                            $rootScope.kernel.loading = 100;
                                                        }
                                                    });
                                                });
                                            });
                                        }

                                        $scope.view = function (document) {
                                            $rootScope.kernel.loading = 0;
                                            var deferred = $q.defer();
                                            $scope.promise = deferred.promise;
                                            function jsonBufferToObject(data, headersGetter, status) {
                                                var type = headersGetter("Content-Type");
                                                if (!type.startsWith("application/json")) {
                                                    return data;
                                                }
                                                ;
                                                var decoder = new TextDecoder("utf-8");
                                                var domString = decoder.decode(data);
                                                var json = JSON.parse(domString);
                                                return json;
                                            }
                                            $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                                                var Download = $injector.get('Download');
                                                Download.start({
                                                    method: 'GET',
                                                    url: '/api/documents/download/' + document._id,
                                                    headers: {'Content-Type': "blob"},
                                                    transformResponse: jsonBufferToObject
                                                }).then(function (response) {
                                                    //var d = new Blob([response.data]);
                                                    var documentToView = new Uint8Array(response.data);
                                                    $mdDialog.show({
                                                        controller: ['$scope', '$mdDialog', 'data', function ($scope, $mdDialog, data) {
                                                                $scope.documentToView = data;
                                                            }],
                                                        templateUrl: '../templates/dialogs/pdfViewer.html',
                                                        parent: angular.element(document.body),
                                                        clickOutsideToClose: true,
                                                        locals: {
                                                            data: documentToView
                                                        }
                                                    }).then(function (answer) {
                                                        //$scope.getAffectations();
                                                    }, function () {
                                                    });
                                                    $rootScope.kernel.loading = 100;
                                                    deferred.resolve(response.data);
                                                }).catch(function (response) {
                                                    console.error(response);
                                                });
                                            });
                                        }

                                        $scope.details = function (p) {
                                            // Increase read 
                                            $ocLazyLoad.load('js/services/DocumentService.js').then(function () {
                                                var Document = $injector.get('Document');
                                                Document.read({id: p._id}).then(function (response) {
                                                    //NO action needed
                                                }).catch(function (response) {
                                                    console.log(response);
                                                });
                                            });
                                            $mdDialog.show({
                                                controller: ['$scope', '$mdDialog', 'p', function ($scope, $mdDialog, p, pdf, pdfjsViewer) {
                                                        $scope.doc = p;
                                                        $scope.close = function () {
                                                            $mdDialog.hide();
                                                        }
                                                        $scope.cancel = function () {
                                                            $mdDialog.cancel();
                                                        };

                                                        $scope.edit = function (doc) {
                                                            $ocLazyLoad.load('js/controllers/staffs/staff/PhysicalRecordCtrl.js').then(function () {
                                                                $mdDialog.show({
                                                                    controller: 'PhysicalRecordController',
                                                                    templateUrl: '../templates/dialogs/physicalRecord.html',
                                                                    parent: angular.element(document.body),
                                                                    clickOutsideToClose: true,
                                                                    locals: {
                                                                        params: {
                                                                            doc: doc
                                                                        }
                                                                    }
                                                                }).then(function (answer) {
                                                                    //$scope.getAffectations();
                                                                }, function () {
                                                                });
                                                            });
                                                        };

                                                        $scope.showConfirm = function (document) {
                                                            var confirm = $mdDialog.confirm()
                                                                    .title(gettextCatalog.getString("Delete this document"))
                                                                    .textContent(gettextCatalog.getString("Are you sure you want to delete this document") + " " + document.fileName + gettextCatalog.getString("?"))
                                                                    .ok(gettextCatalog.getString("Delete"))
                                                                    .cancel(gettextCatalog.getString("Cancel"));

                                                            $mdDialog.show(confirm).then(function () {
                                                                // Delete
                                                                Document1.delete({
                                                                    id: document._id
                                                                }).then(function (response) {
                                                                    $scope.getDocuments();
                                                                    $rootScope.kernel.alerts.push({
                                                                        type: 3,
                                                                        msg: gettextCatalog.getString('The document has been deleted successfully'),
                                                                        priority: 4
                                                                    });
                                                                }).catch(function (response) {
                                                                    console.log(response);
                                                                });
                                                            }, function () {
                                                                // Cancel
                                                            });
                                                        }


                                                        $scope.download = function (document) {
                                                            $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                                                                var FileSaver = $injector.get('FileSaver');
                                                                $rootScope.kernel.loading = 0;
                                                                var deferred = $q.defer();
                                                                $scope.promise = deferred.promise;
                                                                function jsonBufferToObject(data, headersGetter, status) {
                                                                    var type = headersGetter("Content-Type");
                                                                    if (!type.startsWith("application/json")) {
                                                                        return data;
                                                                    }
                                                                    ;
                                                                    var decoder = new TextDecoder("utf-8");
                                                                    var domString = decoder.decode(data);
                                                                    var json = JSON.parse(domString);
                                                                    return json;
                                                                }

                                                                $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                                                                    var Download = $injector.get('Download');
                                                                    Download.start({
                                                                        method: 'GET',
                                                                        url: '/api/documents/download/' + document._id,
                                                                        headers: {'Content-Type': "blob"},
                                                                        transformResponse: jsonBufferToObject
                                                                    }).then(function (response) {
                                                                        var d = new Blob([response.data]);
                                                                        FileSaver.saveAs(d, document.fileName);
                                                                        $rootScope.kernel.loading = 100;
                                                                        deferred.resolve(response.data);
                                                                    }).catch(function (response) {
                                                                        console.error(response);
                                                                        if (response.data && response.data.error === '9500') {
                                                                            $rootScope.kernel.alerts.push({
                                                                                type: 1,
                                                                                msg: gettextCatalog.getString('The Export is too big. Please reduce the date range'),
                                                                                priority: 1
                                                                            });
                                                                            $rootScope.kernel.loading = 100;
                                                                        }
                                                                    });
                                                                });
                                                            });
                                                        }


//
                                                        $scope.view = function (document) {
                                                            $rootScope.kernel.loading = 0;
                                                            var deferred = $q.defer();
                                                            $scope.promise = deferred.promise;
                                                            function jsonBufferToObject(data, headersGetter, status) {
                                                                var type = headersGetter("Content-Type");
                                                                if (!type.startsWith("application/json")) {
                                                                    return data;
                                                                }
                                                                ;
                                                                var decoder = new TextDecoder("utf-8");
                                                                var domString = decoder.decode(data);
                                                                var json = JSON.parse(domString);
                                                                return json;
                                                            }
                                                            $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                                                                var Download = $injector.get('Download');
                                                                Download.start({
                                                                    method: 'GET',
                                                                    url: '/api/documents/download/' + document._id,
                                                                    headers: {'Content-Type': "blob"},
                                                                    transformResponse: jsonBufferToObject
                                                                }).then(function (response) {
                                                                    //var d = new Blob([response.data]);
                                                                    var documentToView = new Uint8Array(response.data);
                                                                    $mdDialog.show({
                                                                        controller: ['$scope', '$mdDialog', 'data', function ($scope, $mdDialog, data) {
                                                                                $scope.documentToView = data;
                                                                            }],
                                                                        templateUrl: '../templates/dialogs/pdfViewer.html',
                                                                        parent: angular.element(document.body),
                                                                        clickOutsideToClose: true,
                                                                        locals: {
                                                                            data: documentToView
                                                                        }
                                                                    }).then(function (answer) {
                                                                        //$scope.getAffectations();
                                                                    }, function () {
                                                                    });
                                                                    $rootScope.kernel.loading = 100;
                                                                    deferred.resolve(response.data);
                                                                }).catch(function (response) {
                                                                    console.error(response);
                                                                });
                                                            });
                                                        }

                                                    }],
                                                templateUrl: '../templates/dialogs/physicalRecordDetails.html',
                                                parent: angular.element(document.body),
                                                clickOutsideToClose: true,
                                                locals: {
                                                    p: p
                                                }
                                            }).then(function (answer) {

                                            }, function () {

                                            });
                                        }


                                    }
                                });
                            });
                        });
                    });
                });
            });
        });


        $ocLazyLoad.load('js/services/SanctionService.js').then(function () {
            var Sanction = $injector.get('Sanction');

            $scope.downloadFollowUpSheet = function () {
                $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                    var FileSaver = $injector.get('FileSaver');
                    $rootScope.kernel.loading = 0;
                    var deferred = $q.defer();
                    $scope.promise = deferred.promise;

                    $http({
                        method: 'GET',
                        url: '/api/export/pdf/followUpSheet/' + $scope.personnelSelected._id,
                        headers: {'Content-Type': "application/pdf"},
                        responseType: "arraybuffer"
                    }).then(function (response) {
                        var d = new Blob([response.data], {type: "application/pdf"});
                        FileSaver.saveAs(d, 'List_of_structures_dgtcfm.pdf');
                        $rootScope.kernel.loading = 100;
                        deferred.resolve(response.data);
                    }).catch(function (response) {
                        console.error(response);
                    });
                });
            };

            $scope.openPdf = function () {
                var cni = $scope.personnelSelected.cni;
                var p = $scope.personnelSelected;
                var structure = ($scope.personnelSelected.affectedTo && $scope.personnelSelected.affectedTo.position) ? $scope.personnelSelected.affectedTo.position.structure : undefined;
                var poste = ($scope.personnelSelected.affectedTo && $scope.personnelSelected.affectedTo.position) ? $scope.personnelSelected.affectedTo.position : undefined;

                var stages = ($scope.personnelSelected.qualifications) ? $scope.personnelSelected.qualifications.schools : [];

                var params = {
                    personnelId: $scope.selectedPersonnelId,
                };
                Sanction.list({filters: JSON.stringify(params)}).then(function (response) {
                    var data = response.data;

                    $scope.sanctions = data.filter(function (el) {
                        return el.type !== "3";
                    });

                    $scope.awards = data.filter(function (el) {
                        return el.type === "3";
                    });

                    $scope.pdfSanctions = [];
                    $scope.sanctionSubTitle = 'Pas de sanction ou récompense enregistrée';
                    if (data.length > 0) {
                        $scope.sanctionSubTitle = 'Sanctions et récompenses';
                    }


                    var dd = {
                        content: [

                            {
                                style: 'tablemarging',
                                table: {
                                    widths: [170, '*', 170],
                                    body: [
                                        [
                                            {
                                                text: 'REPUBLIQUE DU CAMEROUN\n\
                                    Paix- Travail- Patrie\n\--------------\n\
                                    MINISTERE DES FINANCES\n\--------------\n\
                                    DIRECTION GENERALE DU TRESOR DE LA COOPERATION FINANCIERE ET MONETAIRE\n\--------------\n\
                                    ', fontSize: 10, alignment: 'center'
                                            },
                                            {
                                                image: 'data:image/png;base64,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',
                                                width: 90, alignment: 'center'
                                            },
                                            {
                                                text: 'REPUBLIC OF CAMEROON\n\
                                    Peace - Work - Fatherland\n\--------------\n\
                                    MINISTRY OF FINANCE\n\--------------\n\
                                    DIRECTORATE GENERAL OF TREASURY, FINANCIAL AND MONETARY COOPERATION\n\--------------\n\
                                    ', fontSize: 10, alignment: 'center'
                                            },
                                        ]
                                    ]
                                },
                                layout: 'noBorders'
                            },
                            {
                                style: 'headerPadding',
                                table: {
                                    widths: ['*', 120],
                                    body: [
                                        [
                                            {
                                                width: '*',
                                                alignment: 'center',
                                                stack: [
                                                    {
                                                        style: 'header',
                                                        text: 'Fiche de suivi du personnel\n'
                                                    }
                                                ],
                                                border: [false, false, false, false]

                                            },
                                            {
                                                image: "data:image/png;base64,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",
                                                border: [true, true, true, true],
                                                height: 120
                                            }
                                        ]
                                    ]
                                }
                            },
                            {text: 'A: IDENTIFICATION', style: 'subheader1'},
                            {
                                style: 'tablePadding',
                                table: {
                                    widths: ['auto', 'auto', 'auto', 'auto', '*'],
                                    body: [
                                        [{text: 'A1', style: 'tableHeader'}, {text: 'ETAT CIVIL', style: 'tableHeader', colSpan: 4}, {}, {}, {}],
                                        [{}, {text: 'A11', style: 'tableHeader'}, {text: 'Nom : ', style: 'tablecells', border: [true, true, false, true]}, {text: $scope.personnelSelected.name.family, colSpan: 2, style: 'tablecells', border: [false, true, true, true], alignment: 'right'}, {}],
                                        [{}, {text: 'A12', style: 'tableHeader'}, {text: 'Prénom : ', style: 'tablecells', border: [true, true, false, true]}, {text: $scope.personnelSelected.name.given || "", colSpan: 2, style: 'tablecells', border: [false, true, true, true], alignment: 'right'}, {}],
                                        [{}, {text: 'A13', style: 'tableHeader'}, {text: 'Sexe : ', style: 'tablecells', border: [true, true, false, true]}, {text: $scope.personnelSelected.gender, colSpan: 2, style: 'tablecells', border: [false, true, true, true], alignment: 'right'}, {}],
                                        [{}, {text: 'A14', style: 'tableHeader'}, {text: 'Date de naissance : ', style: 'tablecells', border: [true, true, false, true]}, {text: $filter('dateHuman')($scope.personnelSelected.birthDate), colSpan: 2, style: 'tablecells', border: [false, true, true, true], alignment: 'right'}, {}],
                                        [{}, {text: 'A15', style: 'tableHeader'}, {text: 'Lieu de naissance : ', style: 'tablecells', border: [true, true, false, true]}, {text: $scope.personnelSelected.birthPlace, colSpan: 2, style: 'tablecells', border: [false, true, true, true], alignment: 'right'}, {}],
                                        [{}, {text: 'A16', style: 'tableHeader'}, {text: 'Nationalité : ', style: 'tablecells', border: [true, true, false, true]}, {text: "Cameroun", colSpan: 2, style: 'tablecells', border: [false, true, true, true], alignment: 'right'}, {}],
                                        [{}, {text: 'A17', style: 'tableHeader'}, {text: 'N° CNI : ' + (cni.identifier || ""), style: 'tablecells', border: [false, true, true, true]}, {text: 'Date : ' + ($filter('dateHuman')(cni.date) || ""), style: 'tablecells', border: [false, true, true, true]}, {text: 'Lieu : ' + (cni.city || ""), style: 'tablecells', border: [false, true, true, true]}],
                                        [{}, {text: 'A18', style: 'tableHeader'}, {text: 'Unité administrative d\'origine ', colSpan: 3, style: 'tableHeader'}, {}, {}],
                                        [{}, {}, {text: 'A181', style: 'tableHeader'}, {text: 'Région : ', style: 'tablecells', border: [true, true, false, true]}, {text: $scope.personnelSelected.address[0].region || "", style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {}, {text: 'A182', style: 'tableHeader'}, {text: 'Département : ', style: 'tablecells', border: [true, true, false, true]}, {text: $scope.personnelSelected.address[0].department || "", style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {}, {text: 'A183', style: 'tableHeader'}, {text: 'Arrondissement : ', style: 'tablecells', border: [true, true, false, true]}, {text: $scope.personnelSelected.address[0].arrondissement || "" | "", style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {}, {text: 'A184', style: 'tableHeader'}, {text: 'District : ', style: 'tablecells', border: [true, true, false, true]}, {text: $scope.personnelSelected.address[0].district || "" | "", style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {text: 'A19', style: 'tableHeader'}, {text: 'Nom du père : ', style: 'tablecells', border: [true, true, false, true]}, {text: p.father || "", colSpan: 2, style: 'tablecells', border: [false, true, true, true], alignment: 'right'}, {}],
                                        [{}, {text: 'A20', style: 'tableHeader'}, {text: 'Nom de la mère : ', style: 'tablecells', border: [true, true, false, true]}, {text: p.mother || "", colSpan: 2, style: 'tablecells', border: [false, true, true, true], alignment: 'right'}, {}],
                                        [{}, {text: 'A21', style: 'tableHeader'}, {text: 'Statut matrimonial : ', style: 'tablecells', border: [true, true, false, true]}, {text: p.maritalStatus || "", colSpan: 2, style: 'tablecells', border: [false, true, true, true], alignment: 'right'}, {}],
                                        [{}, {text: 'A22', style: 'tableHeader'}, {text: 'Nombre d\'enfant : ', style: 'tablecells', border: [true, true, false, true]}, {text: p.children || "", colSpan: 2, style: 'tablecells', border: [false, true, true, true], alignment: 'right'}, {}]
                                    ]
                                },
                                layout: {
                                    hLineColor: '#000',
                                    vLineColor: '#000',
                                    hLineStyle: function (i, node) {
                                        if (i === 0 || i === node.table.body.length) {
                                            return null;
                                        }
                                        return {solid: {size: 1}};
                                    },
                                    vLineStyle: function (i, node) {
                                        if (i === 0 || i === node.table.widths.length) {
                                            return null;
                                        }
                                        return {solid: {size: 1}};
                                    },
                                    fillColor: function (rowIndex, node, columnIndex) {
                                        return (columnIndex < 2) ? '#ddd' : null;
                                    }
                                }
                            },
                            {text: 'B: LOCALISATION', style: 'subheader'},
                            {
                                style: 'tablePadding',
                                table: {
                                    widths: ['auto', 'auto', 'auto', '*'],
                                    body: [
                                        [{text: 'B1', style: 'tableHeader'}, {text: 'TYPE DE SERVICE :', style: 'tableHeader', colSpan: 2}, {}, {}],

                                        [{text: 'B2', style: 'tableHeader'}, {text: 'STRUCTURE', style: 'tableHeader', colSpan: 3}, {}, {}],
                                        [{}, {text: 'B21', style: 'tableHeader'}, {text: 'Type de structure : ', style: 'tablecells'}, {text: (structure) ? structure.typeValue || "" : "", style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {text: 'B22', style: 'tableHeader'}, {text: 'Nom de la structure : ', style: 'tablecells'}, {text: ($scope.personnelSelected.affectedTo ? $scope.personnelSelected.affectedTo.position.structure.father.name || "" : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {text: 'B23', style: 'tableHeader'}, {text: 'Sous structure : ', style: 'tablecells'}, {text: ($scope.personnelSelected.affectedTo ? $scope.personnelSelected.affectedTo.position.structure.name || "" : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {text: 'B24', style: 'tableHeader'}, {text: 'Service : ', style: 'tablecells'}, {text: '', style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {text: 'B25', style: 'tableHeader'}, {text: 'Bureau : ', style: 'tablecells'}, {text: '', style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{text: 'B3', style: 'tableHeader'}, {text: 'UNITE ADMINISTRATIVE DE TRAVAIL', style: 'tableHeader', colSpan: 3}, {}, {}],
                                        [{}, {text: 'B31', style: 'tableHeader'}, {text: 'Région : ', style: 'tablecells'}, {text: ($scope.personnelSelected.affectedTo ? $scope.personnelSelected.affectedTo.position.structure.address[0].region || "" : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {text: 'B32', style: 'tableHeader'}, {text: 'Département : ', style: 'tablecells'}, {text: ($scope.personnelSelected.affectedTo ? $scope.personnelSelected.affectedTo.position.structure.address[0].department || "" : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {text: 'B33', style: 'tableHeader'}, {text: 'Arrondissement : ', style: 'tablecells'}, {text: '', style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{text: 'B4', style: 'tableHeader'}, {text: 'ADRESSE DE L\'EMPLOYE', style: 'tableHeader', colSpan: 3}, {}, {}],
                                        [{}, {text: 'B41', style: 'tableHeader'}, {text: 'Télépphone portable : ', style: 'tablecells'}, {text: p.telecom && p.telecom[0] ? p.telecom[0].value || "" : "", style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {text: 'B42', style: 'tableHeader'}, {text: 'Personne à prevenir : ', style: 'tablecells'}, {text: p.telecom && p.telecom[2] ? p.telecom[2].personToContact || "" : "", style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {text: 'B43', style: 'tableHeader'}, {text: 'Télépphone personne à prevenir : ', style: 'tablecells'}, {text: p.telecom && p.telecom[2] ? p.telecom[2].value || "" : "", style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {text: 'B44', style: 'tableHeader'}, {text: 'Email : ', style: 'tablecells'}, {text: p.telecom && p.telecom[1] ? p.telecom[1].value || "" : "", style: 'tablecells', border: [false, true, true, true], alignment: 'right'}]
                                    ]
                                },
                                layout: {
                                    hLineColor: '#000',
                                    vLineColor: '#000',
                                    hLineStyle: function (i, node) {
                                        if (i === 0 || i === node.table.body.length) {
                                            return null;
                                        }
                                        return {solid: {size: 1}};
                                    },
                                    vLineStyle: function (i, node) {
                                        if (i === 0 || i === node.table.widths.length) {
                                            return null;
                                        }
                                        return {solid: {size: 1}};
                                    },
                                    fillColor: function (rowIndex, node, columnIndex) {
                                        return (columnIndex < 2) ? '#ddd' : null;
                                    }
                                }
                            },
                            {text: 'C: QUALIFICATION', style: 'subheader'},
                            {
                                style: 'tablePadding',
                                table: {
                                    widths: ['auto', 'auto', 'auto', 'auto', '*'],
                                    body: [
                                        [{text: 'C1', style: 'tableHeader'}, {text: 'TITRES SCOLAIRES OU UNIVERSITAIRE', style: 'tableHeader', colSpan: 4}, {}, {}, {}],
                                        [{}, {text: 'C11', style: 'tableHeader'}, {text: 'Niveau instruction : ' + (p.qualifications ? p.qualifications.highestLevelEducation : ""), style: 'tablecells', colSpan: 3}, {}, {}],

                                        [{}, {text: 'C12', style: 'tableHeader'}, {text: 'Diplôme de recrutement', style: 'tableHeader', colSpan: 3}, {}, {}],
                                        [{}, {}, {text: 'C1201', style: 'tableHeader'}, {text: 'Libellé du diplôme : ', style: 'tablecells', border: [true, true, false, true]}, {text: (p.qualifications && p.qualifications.schools && p.qualifications.schools[1] && p.qualifications.schools[1].diploma ? p.qualifications.schools[1].diploma : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {}, {text: 'C1202', style: 'tableHeader'}, {text: 'Date  : ', style: 'tablecells', border: [true, true, false, true]}, {text: $filter('dateHuman')(p.qualifications && p.qualifications.schools && p.qualifications.schools[1] && p.qualifications.schools[1].date ? p.qualifications.schools[1].date : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {}, {text: 'C1203', style: 'tableHeader'}, {text: 'Lieu d\'obtention  : ', style: 'tablecells', border: [true, true, false, true]}, {text: (p.qualifications && p.qualifications.schools && p.qualifications.schools[1] && p.qualifications.schools[1].authority ? p.qualifications.schools[1].authority : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {}, {text: 'C1204', style: 'tableHeader'}, {text: 'Option : ', style: 'tablecells', border: [true, true, false, true]}, {text: (p.qualifications && p.qualifications.schools && p.qualifications.schools[1] && p.qualifications.schools[1].option ? p.qualifications.schools[1].option : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {}, {text: 'C1205', style: 'tableHeader'}, {text: 'Domaine  : ', style: 'tablecells', border: [true, true, false, true]}, {text: (p.qualifications && p.qualifications.schools && p.qualifications.schools[1] && p.qualifications.schools[1].domain ? p.qualifications.schools[1].domain : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],

                                        [{}, {text: 'C13', style: 'tableHeader'}, {text: 'Diplôme le plus élevé', style: 'tableHeader', colSpan: 3}, {}, {}],
                                        [{}, {}, {text: 'C1301', style: 'tableHeader'}, {text: 'Libellé du diplôme : ', style: 'tablecells', border: [true, true, false, true]}, {text: (p.qualifications && p.qualifications.schools && p.qualifications.schools[0] && p.qualifications.schools[0].diploma ? p.qualifications.schools[0].diploma : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {}, {text: 'C1302', style: 'tableHeader'}, {text: 'Date  : ', style: 'tablecells', border: [true, true, false, true]}, {text: $filter('dateHuman')(p.qualifications && p.qualifications.schools && p.qualifications.schools[0] && p.qualifications.schools[0].date ? p.qualifications.schools[0].date : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {}, {text: 'C1303', style: 'tableHeader'}, {text: 'Lieu d\'obtention  : ', style: 'tablecells', border: [true, true, false, true]}, {text: (p.qualifications && p.qualifications.schools && p.qualifications.schools[0] && p.qualifications.schools[0].authority ? p.qualifications.schools[0].authority : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {}, {text: 'C1304', style: 'tableHeader'}, {text: 'Option : ', style: 'tablecells', border: [true, true, false, true]}, {text: (p.qualifications && p.qualifications.schools && p.qualifications.schools[0] && p.qualifications.schools[0].option ? p.qualifications.schools[0].option : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{}, {}, {text: 'C1305', style: 'tableHeader'}, {text: 'Domaine  : ', style: 'tablecells', border: [true, true, false, true]}, {text: (p.qualifications && p.qualifications.schools && p.qualifications.schools[0] && p.qualifications.schools[0].domain ? p.qualifications.schools[0].domain : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],

                                        [{text: 'C2', style: 'tableHeader'}, {text: 'STAGES :', style: 'tableHeader', colSpan: 4}, {}, {}, {}]
                                    ]
                                },
                                layout: {
                                    hLineColor: '#000',
                                    vLineColor: '#000',
                                    hLineStyle: function (i, node) {
                                        if (i === 0 || i === node.table.body.length) {
                                            return null;
                                        }
                                        return {solid: {size: 1}};
                                    },
                                    vLineStyle: function (i, node) {
                                        if (i === 0 || i === node.table.widths.length) {
                                            return null;
                                        }
                                        return {solid: {size: 1}};
                                    },
                                    fillColor: function (rowIndex, node, columnIndex) {
                                        return (columnIndex < 2) ? '#ddd' : null;
                                    }
                                }
                            },
                            {text: 'D: RECRUTEMENT', style: 'subheader'},
                            {
                                style: 'tablePadding',
                                table: {
                                    widths: ['auto', 'auto', '*'],
                                    body: [
                                        [{text: 'D1', style: 'tableHeader'}, {text: 'N° acte de retrutement : ', style: 'tablecells', border: [true, true, false, true]}, {text: ((p.history && p.history.recruitmentActNumber) ? p.history.recruitmentActNumber : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{text: 'D2', style: 'tableHeader'}, {text: 'Nature de l\'acte : ', style: 'tablecells', border: [true, true, false, true]}, {text: ((p.history && p.history.nature) ? p.history.nature : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{text: 'D3', style: 'tableHeader'}, {text: 'Date de signature : ', style: 'tablecells', border: [true, true, false, true]}, {text: $filter('dateHuman')((p.history && p.history.signatureDate) ? p.history.signatureDate : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{text: 'D4', style: 'tableHeader'}, {text: 'Titre du signature : ', style: 'tablecells', border: [true, true, false, true]}, {text: ((p.history && p.history.signatory) ? p.history.signatory : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{text: 'D5', style: 'tableHeader'}, {text: 'Date de prise d\'effet : ', style: 'tablecells', border: [true, true, false, true]}, {text: $filter('dateHuman')((p.history && p.history.startDate) ? p.history.startDate : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}]
                                    ]
                                },
                                layout: {
                                    hLineColor: '#000',
                                    vLineColor: '#000',
                                    hLineStyle: function (i, node) {
                                        if (i === 0 || i === node.table.body.length) {
                                            return null;
                                        }
                                        return {solid: {size: 1}};
                                    },
                                    vLineStyle: function (i, node) {
                                        if (i === 0 || i === node.table.widths.length) {
                                            return null;
                                        }
                                        return {solid: {size: 1}};
                                    },
                                    fillColor: function (rowIndex, node, columnIndex) {
                                        return (columnIndex < 2) ? '#ddd' : null;
                                    }
                                }
                            },
                            {text: 'E: SITUATION ACTUELLE', style: 'subheader'},
                            {
                                style: 'tablePadding',
                                table: {
                                    widths: ['auto', 'auto', '*'],
                                    body: [
                                        [{text: 'E1', style: 'tableHeader'}, {text: 'Matricule : ', style: 'tablecells', border: [true, true, false, true]}, {text: p.identifier, style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{text: 'E2', style: 'tableHeader'}, {text: 'Statut : ', style: 'tablecells', border: [true, true, false, true]}, {text: p.status, style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{text: 'E3', style: 'tableHeader'}, {text: 'Corps : ', style: 'tablecells', border: [true, true, false, true]}, {text: p.corps, style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{text: 'E4', style: 'tableHeader'}, {text: 'Grade : ', style: 'tablecells', border: [true, true, false, true]}, {text: p.grade, style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{text: 'E5', style: 'tableHeader'}, {text: 'Poste de travail actuel : ', style: 'tablecells', border: [true, true, false, true]}, {text: (p.affectedTo ? p.affectedTo.position.name : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{text: 'E6', style: 'tableHeader'}, {text: 'Date de début au poste : ', style: 'tablecells', border: [true, true, false, true]}, {text: $filter('dateHuman')(p.affectedTo ? p.affectedTo.date : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{text: 'E7', style: 'tableHeader'}, {text: 'Fonction actuelle : ', style: 'tablecells', border: [true, true, false, true]}, {text: (p.affectedTo ? p.affectedTo.position.name : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{text: 'E8', style: 'tableHeader'}, {text: 'N° acte de nomination : ', style: 'tablecells', border: [true, true, false, true]}, {text: '', style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{text: 'E9', style: 'tableHeader'}, {text: 'Date de début de la fonction : ', style: 'tablecells', border: [true, true, false, true]}, {text: $filter('dateHuman')(p.affectedTo ? p.affectedTo.date : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{text: 'E10', style: 'tableHeader'}, {text: 'Date d\'entrée dans l\'Administrationn : ', style: 'tablecells', border: [true, true, false, true]}, {text: $filter('dateHuman')(p.history ? p.history.signatureDate : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{text: 'E11', style: 'tableHeader'}, {text: 'Date d\'entrée au MINFI : ', style: 'tablecells', border: [true, true, false, true]}, {text: $filter('dateHuman')(p.history ? p.history.minfiEntryDate : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                        [{text: 'E12', style: 'tableHeader'}, {text: 'Administration de recrutement : ', style: 'tablecells', border: [true, true, false, true]}, {text: $filter('dateHuman')(p.history ? p.history.originalAdministration : ""), style: 'tablecells', border: [false, true, true, true], alignment: 'right'}],
                                    ]
                                },
                                layout: {
                                    hLineColor: '#000',
                                    vLineColor: '#000',
                                    hLineStyle: function (i, node) {
                                        if (i === 0 || i === node.table.body.length) {
                                            return null;
                                        }
                                        return {solid: {size: 1}};
                                    },
                                    vLineStyle: function (i, node) {
                                        if (i === 0 || i === node.table.widths.length) {
                                            return null;
                                        }
                                        return {solid: {size: 1}};
                                    },
                                    fillColor: function (rowIndex, node, columnIndex) {
                                        return (columnIndex < 2) ? '#ddd' : null;
                                    }
                                }
                            }
                        ],
                        footer: function (currentPage, pageCount, pageSize) {
                            return [
                                {text: 'SYGEPE-DGTCFM\nImprimé le ' + $filter('date')(new Date(), "dd/MM/yyyy HH:mm:s"), alignment: 'left', margin: [40, 0], fontSize: 8, color: '#000000'},
                                {text: currentPage.toString() + ' / ' + pageCount, alignment: 'right', margin: [40, -15], fontSize: 8},
                                {qr: 'Fiche de suivi du personnel', fit: 40, alignment: 'center', margin: [0, 0]}
                            ];
                        },
                        pageMargins: [40, 40, 40, 50],

                        styles: {
                            header: {
                                fontSize: 16,
                                bold: true,
                                alignment: 'center',
                                margin: [0, 30, 0, 0]
                            },
                            headerPadding: {
                                margin: [0, -15, 0, 0]
                            },
                            subheader1: {
                                fontSize: 14,
                                bold: true,
                                margin: [0, -10, 0, 5]
                            },
                            subheader: {
                                fontSize: 14,
                                bold: true,
                                margin: [0, 10, 0, 5]
                            },
                            tablemarging: {
                                margin: [0, 5, 0, 15]
                            },
                            tableHeader: {
                                bold: true,
                                fontSize: 10,
                                color: 'black',
                                alignment: 'left',
                                fillColor: '#dddddd'
                            },
                            tablecells: {
                                fontSize: 10,
                                alignment: 'left'
                            }
                        },
                        defaultStyle: {
                            // alignment: 'justify'
                        }

                    }

                    dd.content.push({text: 'F: PARCOURS PROFESSIONNEL', style: 'subheader'})
                    var affectationData = {
                        style: 'tablePadding',
                        table: {
                            widths: ['auto', 'auto', '*', '*', '*'],
                            body: [
                                [{}, {}, {text: 'Poste', style: 'tableHeader'}, {text: 'Structure', style: 'tableHeader'}, {text: 'Date', style: 'tableHeader'}],
                            ]
                        },
                        layout: {
                            hLineColor: '#000',
                            vLineColor: '#000',
                            hLineStyle: function (i, node) {
                                if (i === 0 || i === node.table.body.length) {
                                    return null;
                                }
                                return {solid: {size: 1}};
                            },
                            vLineStyle: function (i, node) {
                                if (i === 0 || i === node.table.widths.length) {
                                    return null;
                                }
                                return {solid: {size: 1}};
                            },
                            fillColor: function (rowIndex, node, columnIndex) {
                                return (columnIndex < 2) ? '#ddd' : null;
                            }
                        }
                    }
                    if ($scope.allAffectations.length > 0) {
                        for (var i = 0; i < $scope.allAffectations.length; i++) {
                            var s = [
                                {}, {text: 'F1' + i + 1, style: 'tableHeader'},
                                {text: $scope.allAffectations[i].newPosition.fr, style: 'tablecells', border: [true, true, true, true], alignment: 'left'},
                                {text: $scope.allAffectations[i].structureAffectation.fr + "\n - " + $scope.allAffectations[i].structureAffectationFather.fr, style: 'tablecells', border: [true, true, true, true], alignment: 'left'},
                                {text: $filter('dateHuman')($scope.allAffectations[i].startDate), style: 'tablecells', border: [true, true, true, true], alignment: 'left'}
                            ];
                            affectationData.table.body.push(s);
                        }
                    }
                    dd.content.push(affectationData);


                    //Sanction et récompense
                    dd.content.push({text: 'G: DOSSIER DISCIPLINAIRE', style: 'subheader'})
                    var sanctionData = {
                        style: 'tablePadding',
                        table: {
                            widths: ['auto', 'auto', '*', '*', '*'],
                            body: [
                                [{text: 'G1', style: 'tableHeader'}, {text: $scope.sanctionSubTitle, style: 'tableHeader', colSpan: 4}, {}, {}, {}],
                            ]
                        },
                        layout: {
                            hLineColor: '#000',
                            vLineColor: '#000',
                            hLineStyle: function (i, node) {
                                if (i === 0 || i === node.table.body.length) {
                                    return null;
                                }
                                return {solid: {size: 1}};
                            },
                            vLineStyle: function (i, node) {
                                if (i === 0 || i === node.table.widths.length) {
                                    return null;
                                }
                                return {solid: {size: 1}};
                            },
                            fillColor: function (rowIndex, node, columnIndex) {
                                return (columnIndex < 2) ? '#ddd' : null;
                            }
                        }
                    }

                    if (data.length > 0) {
                        $scope.sanctionSubTitle = 'Sanctions et récompenses';
                        sanctionData.table.body.push([{}, {}, {text: 'Sanction / récompense', style: 'tableHeader'}, {text: 'Poste', style: 'tableHeader'}, {text: 'Date', style: 'tableHeader'}])
                        for (var i = 0; i < data.length; i++) {
                            var s = [
                                {}, {text: 'F1' + i, style: 'tableHeader'},
                                {text: (data[i].indisciplineBeautified + " : " + data[i].sanctionBeautified + "\n" + data[i].natureBeautified + " : " + data[i].referenceNumber), style: 'tablecells', border: [true, true, true, true], alignment: 'right'},
                                {text: data[i].newPosition.fr + " - " + data[i].structureAffectation.fr + " - " + data[i].structureAffectationFather.fr, style: 'tablecells', border: [true, true, true, true], alignment: 'right'},
                                {text: $filter('dateHuman')(data[i].dateofSignature), style: 'tablecells', border: [true, true, true, true], alignment: 'right'}
                            ];
                            sanctionData.table.body.push(s);
                        }
                    }
                    dd.content.push(sanctionData);




                    var stages = [];
                    var stagesToPDF = [{}, {text: 'C21', style: 'tableHeader'}, {text: 'Stage 1 : ', style: 'tablecells', colSpan: 3}, {}, {}];
                    if ($scope.personnelSelected.qualifications && $scope.personnelSelected.qualifications.stages) {
                        stages = $scope.personnelSelected.qualifications.stages;

                        stagesToPDF = [];
                        for (var i = 0; i < stages.length; i++) {
                            var s = stages[i].title + ', ' + stages[i].authority + ' (' + $filter('dateHuman')(stages[i].from) + ' - ' + $filter('dateHuman')(stages[i].to) + ')';
                            var st = [{}, {text: 'C21', style: 'tableHeader'}, {text: 'Stage 1 : ' + s, style: 'tablecells', colSpan: 3}, {}, {}]
                            dd.content[7].table.body.push(st);
                        }
                    } else {
                        dd.content[7].table.body.push(stagesToPDF);
                    }
                    pdfMake.createPdf(dd).open();
                    $scope.loadingChart = false;
                }).catch(function (response) {
                    if (response.xhrStatus !== "abort") {
                        console.error(response);
                        $rootScope.kernel.alerts.push({
                            type: 1,
                            msg: gettextCatalog.getString('An error occurred, please try again later'),
                            priority: 2
                        });
                    }
                    $scope.loadingChart = false;
                });

            };
        });
    });
});
