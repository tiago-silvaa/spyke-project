

function fetchContacts () {
    fetch('/contactsData')
        .then(response => response.json())
        .then(contacts => {

            displayContacts(contacts);

            document.querySelectorAll('.syncGoogleCheckbox').forEach(checkbox => {
                checkbox.addEventListener('change', async (event) => {
                    const syncFilter = document.querySelector('input[name="filterOptions"]:checked').value;
                    toggleSync(event.target, syncFilter);
                });
            });
             
        })
}

function displayContacts(contacts, noContactsMessage = 'You have no contacts in your spyke, please add some.') {
    const contactList = document.getElementById('contact-list');
    contactList.innerHTML = '';

    if (contacts.length === 0) {
        contactList.innerHTML = `
            <div class="alert alert-primary alert-dismissible fade show mt-2" style="width: 470px; border-radius: 40px;">
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                <strong>${noContactsMessage}</strong>
            </div>
        `
        
    } else {
        contactList.innerHTML = `
            <table class="table table-bordered table-hover table-striped">
                <thead class="thead-light">
                    <tr class="table-dark">
                        <th style="width: 5%;">Sync</th>
                        <th style="width: 20%;">Name</th>
                        <th style="width: 25%;">Phone Number</th>
                        <th style="width: 30%;">Email</th>
                        <th style="width: 10%;" class="text-center">Activate Sync</th>
                        <th class="text-center" style="width: 5%;"></th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `

        const tbody = contactList.querySelector('tbody');

        contacts.forEach(contact => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <button type="button" id="syncContacts" class="btn btn-outline-dark btn-sm" style="border-radius: 50%;"
                    data-bs-toggle="tooltip" data-bs-placement="left" title="Sync contact" onclick="syncContact(${contact.id})">
                        <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                </td>
                <td>${contact.name}</td>
                <td>${contact.phone}</td>
                <td>${contact.email}</td>
                <td class="text-center">
                    <input type="checkbox" class="syncGoogleCheckbox" data-id="${contact.id}" ${contact.syncGoogle ? 'checked' : ''}>
                </td>
                <td class="text-center">
                    <div class="dropdown dropend" style="text-center">
                        <button class="btn btn-outline-secondary rounded-circle btn-sm" type="button" id="dropdownMenuButton-${contact.id}" data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="bi bi-three-dots-vertical"></i>
                        </button>
                        <ul class="dropdown-menu" aria-labelledby="dropdownMenuButton-${contact.id}">
                            <li><a class="dropdown-item" href="javascript:void(0);" onclick="editContact(${contact.id})" >Edit <i class="fa-solid fa-pen-to-square float-end"></i></a></li>
                            <li><a class="dropdown-item" href="javascript:void(0);" onclick="deleteContact(${contact.id})" >Delete <i class="fa-solid fa-trash float-end"></i></a></li>
                        </ul>
                    <div class="dropdown">
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function updateContactCount(totalContacts) {
    const contactsCount = document.getElementById('contactsCount');
    if (contactsCount) {
        contactsCount.textContent = totalContacts;
    }
}

document.addEventListener('DOMContentLoaded', () => {

    fetchContacts();

    fetchGoogleContacts();

    document.getElementById('searchContact').addEventListener('input', searchContact);

    document.querySelectorAll('input[name="filterOptions"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const filterOption = this.value;
            if (filterOption === 'all') {
                fetchContacts();
            } else {
                fetchContactsBySync(filterOption);
            }
        });
    });
})

function createContact() {
    fetch('/isGoogleAuthenticated')
        .then(response => response.json())
        .then(data => {
            const isGoogleAuthenticated = data.authenticated;

            Swal.fire({
                title: 'New Contact',
                html: `
                    <input type="text" id="contactName" class="swal2-input" placeholder="Nome">
                    <input type="text" id="contactPhone" class="swal2-input" placeholder="Telefone">
                    <input type="email" id="contactEmail" class="swal2-input" placeholder="Email">
                    ${isGoogleAuthenticated ? '<label><input type="checkbox" class="mt-3" id="syncGoogle"> Sync with Google</label>' : 
                        
                        `<div class="alert alert-info alert-dismissible fade show" style="margin-top: 20px; margin-bottom: -5px;">
                            Connect to your <a href="/auth/google"><strong>google account</strong></a> to synchronize contacts automatically.
                        </div>`}
                `,
                showCancelButton: true,
                confirmButtonText: 'Add',
                preConfirm: () => {
                    const name = document.getElementById('contactName').value;
                    const phone = document.getElementById('contactPhone').value;
                    const email = document.getElementById('contactEmail').value;
                    const syncGoogle = isGoogleAuthenticated ? document.getElementById('syncGoogle').checked : false;
                    if (!name || !phone) {
                        Swal.showValidationMessage('Please, fill a name or phone number.');
                        return;
                    }
                    return { name, phone, email, syncGoogle };
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    const contact = result.value;
                    
                    if (contact.syncGoogle) {
                        Swal.fire({
                            title: 'Creating and synchronizing contact with <img src="/images/google-logo.png" alt="Google Logo G" style="height: 35px; margin-left: 5px; margin-right: 5px;">',
                            allowOutsideClick: false,
                            didOpen: () => {
                                Swal.showLoading();
                            }
                        });
                    }
                    fetch('/addContact', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(contact)
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.message === 'Google authentication required') {
                            Swal.fire({
                                title: data.message,
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonText: 'Connect <i class="bi bi-google"></i>' 
                            }).then((result) => {
                                if (result.isConfirmed) {
                                    window.location.href = '/auth/google';
                                }
                            })
                        } else if (data.status === 'duplicate') {
                            if (data.attribute === 'namePhone') {
                                Swal.fire({
                                    title: 'Contact already exists.',
                                    text: 'You already have an existing contact with the same name and phone number.',
                                    icon: 'warning'
                                }).then(() => {
                                    createContact();
                                });
                            } else if (data.attribute === 'name') {
                                Swal.fire({
                                    title: 'Contact already exists.',
                                    text: 'You already have an existing contact with the same name.',
                                    icon: 'warning'
                                }).then(() => {
                                    createContact();
                                });
                            } else if (data.attribute === 'phone') {
                                Swal.fire({
                                    title: 'Contact already exists.',
                                    text: 'You already have an existing contact with the same phone number.',
                                    icon: 'warning'
                                }).then(() => {
                                    createContact();
                                });
                            } else {
                                Swal.fire({
                                    title: 'Contact already exists.',
                                    icon: 'warning'
                                }).then(() => {
                                    createContact();
                                });
                            }
                        } else {
                            Swal.fire(
                                'Contact created!',
                                data.message,
                                'success'
                            )
                            fetchContacts();
                            
                            document.getElementById('searchContact').value = '';

                            updateContactCount(data.totalContacts);
                        }
                    })
                }
            })
        });
}

function fetchGoogleContacts() {
    fetch('/googleContactsData')
        .then(response => response.json())
        .then(data => {
            const googleContactTable = document.getElementById('google-contacts-table');
            googleContactTable.innerHTML = '';

            data.sort((a, b) => {
                const nameA = a.names ? a.names[0].displayName.toUpperCase() : '';
                const nameB = b.names ? b.names[0].displayName.toUpperCase() : '';
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                return 0;
            });

            if (data.length === 0) {
                googleContactTable.innerHTML = `
                    <div class="alert alert-primary alert-dismissible fade show mt-2" style="width: 450px; border-radius: 40px;">
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                        You have <strong>no contacts</strong> in your <i class="bi bi-google"></i> Contacts.
                    </div>
                `
                
            } else {
                googleContactTable.innerHTML = `
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th style="width: 25%;">Name</th>
                                <th style="width: 25%;">Phone Number</th>
                                <th style="width: 30%;">Email</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                `

                const tbody = googleContactTable.querySelector('tbody');
            
                data.forEach(contact => {
                    const tr = document.createElement('tr');

                    const name = contact.names ? contact.names[0].displayName : '';
                    const phone = contact.phoneNumbers ? contact.phoneNumbers[0].value : '';
                    const email = contact.emailAddresses ? contact.emailAddresses[0].value : '';

                        tr.innerHTML = `
                            <td>${name}</td>
                            <td>${phone}</td>
                            <td>${email}</td>
                        `;
                        tbody.appendChild(tr);
                })
            }         
        })
}

function importGoogleContactsModal() {
    Swal.fire({
        title: 'Are you sure?',
        icon: 'warning',
        text: 'Import all your Google Contacts?',
        showCancelButton: true,
        confirmButtonText: 'Import Google Contacts <i class="bi bi-download"></i>'
    })
    .then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Importing <img src="/images/google-logo.png" alt="Google Logo G" style="height: 40px; margin-left: 5px; margin-right: 5px;"> Contacts',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            fetch('/importGoogleContacts')
                .then(response => response.json())
                .then(data => {
                    fetchContacts();
                    updateContactCount(data.totalContacts);
                    let googleListModal = bootstrap.Modal.getInstance(document.getElementById('googleList'));
                    googleListModal.hide();
                    Swal.fire({
                        title: 'Imported!',
                        icon: 'success',
                        text: data.message
                    })
                })
        }
    }) 
}

function importGoogleContacts() {
    Swal.fire({
        title: 'Are you sure?',
        icon: 'warning',
        text: 'Import all your Google Contacts?',
        showCancelButton: true,
        confirmButtonText: 'Import Google Contacts <i class="bi bi-download"></i>'
    })
    .then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Importing <img src="/images/google-logo.png" alt="Google Logo G" style="height: 40px; margin-left: 5px; margin-right: 5px;"> Contacts',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            fetch('/importGoogleContacts')
                .then(response => response.json())
                .then(data => {
                    fetchContacts();
                    document.getElementById('searchContact').value = '';
                    updateContactCount(data.totalContacts);
                    Swal.fire({
                        title: 'Imported!',
                        icon: 'success',
                        text: data.message
                    })
                })
        }
    }) 
}

function syncContacts() {
    Swal.fire({
        title: 'Sync contacts with <img src="/images/google-logo.png" alt="Google Logo G" style="height: 30px; margin-left: 5px; margin-right: 5px;"> ?',
        icon: 'warning',
        text: 'It will synchronize all the contacts you have selected as "Sync with Google".',
        showCancelButton: true,
        confirmButtonText: 'Sync contacts <i class="bi bi-arrow-repeat"></i>'
    })
    .then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Synchronizing contacts...',
                text: 'It might take some minutes.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            fetch('/syncContacts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
                .then(response => response.json())
                .then(data => {
                    fetchContacts();
                    document.getElementById('searchContact').value = '';
                    if (data.success) {
                        Swal.fire({
                            title: 'Synchronized!',
                            icon:'success',
                            text: data.message
                        })
                    } else {
                        Swal.fire({
                            title: data.message,
                            icon:'warning'
                        })
                    }
                })
        }
    }) 
}

function syncExistingContacts() {
    Swal.fire({
        title: 'Sync existing contacts with <img src="/images/google-logo.png" alt="Google Logo G" style="height: 35px; margin-left: 5px; margin-right: 5px;"> ?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sync contacts <i class="bi bi-arrow-repeat"></i>'
    })
    .then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Synchronizing contacts...',
                text: 'It might take some minutes.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            fetch('/syncContacts/googleConfig', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
                .then(response => response.json())
                .then(data => {
                    fetchContacts();
                    
                    document.getElementById('searchContact').value = '';

                    if (data.success) {
                        Swal.fire({
                            title: 'Synchronized!',
                            icon:'success',
                            text: data.message
                        })
                    } else {
                        Swal.fire({
                            title: data.message,
                            icon:'warning'
                        })
                    }
                })
        }
    }) 
}

function toggleSync(checkbox, filterOption) {
    const contactId = checkbox.dataset.id;
    if (checkbox.checked) {
        activateSync(contactId, filterOption);
    } else {
        deactivateSync(contactId, filterOption);
    }
}

function activateSync(contactId, filterOption) {
    fetch(`/contacts/${contactId}/activateSync`, {
        method: 'POST',
    })
    .then(response => response.json())
    .then(() => {
        Swal.fire({
            position: 'top-start',
            icon: 'success',
            title: 'Sync option <strong>on</strong>',
            toast: true,
            showConfirmButton: false,
            timer: 1350,
            timerProgressBar: true,
            hideClass: {
                popup: 'animate__animated animate__fadeOut animate__faster'
            }
        });
        if (filterOption === 'all') {
            fetchContacts();
        } else {
            fetchContactsBySync(filterOption);
        }
    })
    .catch(error => {
        Swal.fire('Error!', 'Failed to activate sync.', 'error');
        console.error('Error activating sync:', error);
    });
}

function deactivateSync(contactId, filterOption) {
    fetch(`/contacts/${contactId}/deactivateSync`, {
        method: 'POST',
    })
    .then(response => response.json())
    .then(() => {
        Swal.fire({
            position: 'top-start',
            icon: 'success',
            title: 'Sync option <strong>off</strong>',
            toast: true,
            showConfirmButton: false,
            timer: 1350,
            timerProgressBar: true,
            hideClass: {
                popup: 'animate__animated animate__fadeOut animate__faster'
            }
        });
        if (filterOption === 'all') {
            fetchContacts();
        } else {
            fetchContactsBySync(filterOption);
        }
    })
    .catch(error => {
        Swal.fire('Error!', 'Failed to activate sync.', 'error');
        console.error('Error activating sync:', error);
    });
}

function logout() {

    Swal.fire({
        title: 'Are you sure?',
        icon: 'warning',
        text: 'Do you want to logout?',
        showCancelButton: true,
        confirmButtonText: 'Logout <i class="bi bi-box-arrow-left"></i>'
    })
    .then((result) => {
        if (result.isConfirmed) {
            fetch('/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
            })
                .then(response => response.json())
                .then(data => {
                    Swal.fire({
                        title: data.message,
                        icon: 'success'
                    }).then(() => {
                        window.location.href = '/';
                    });
                })
        }
    })
}

function deleteContact(contactId) {
    Swal.fire({
        title: 'Are you sure?',
        text: "Do you want to delete the selected contact?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete contact!'
    }).then((result) => {
        if (result.isConfirmed) {
            fetch(`/contacts/${contactId}/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
            })
            .then(response => response.json())
            .then(data => {
                fetchContacts();

                document.getElementById('searchContact').value = '';

                updateContactCount(data.totalContacts);

                Swal.fire(
                    'Deleted!',
                    'Your contact has been deleted.',
                    'success'
                );
            });
        }
    });
}

function editContact(contactId) {
    fetch(`/contacts/${contactId}`)
        .then(response => response.json())
        .then(contact => {
            Swal.fire({
                title: 'Edit Contact <i class="fa-solid fa-pen-to-square"></i>',
                html: `
                    <input type="text" id="contactName" class="swal2-input" placeholder="Name" value="${contact.name}">
                    <input type="text" id="contactPhone" class="swal2-input" placeholder="Phone" value="${contact.phone}">
                    <input type="email" id="contactEmail" class="swal2-input" placeholder="Email" value="${contact.email}">
                `,
                showCancelButton: true,
                confirmButtonText: 'Save',
                preConfirm: () => {
                    const name = document.getElementById('contactName').value;
                    const phone = document.getElementById('contactPhone').value;
                    const email = document.getElementById('contactEmail').value;
                    if (!name || !phone) {
                        Swal.showValidationMessage('Please, insert a name / phone number');
                        return;
                    }
                    return { name, phone, email };
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    const contact = result.value;
                    fetch(`/contacts/${contactId}/update`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(contact)
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.message) {
                            Swal.fire({
                                title: data.message,
                                icon: 'success'
                            });
                            fetchContacts();

                            const contactsCount = document.getElementById('contactsCount');
                            if (contactsCount) {
                                contactsCount.textContent = data.totalContacts;
                            }   
                        }
                    });
                }
            });
        })
}

function syncContact(contactId) {
    fetch('/isGoogleAuthenticated')
        .then(response => response.json())
        .then(data => {
            if (!data.authenticated) {
                Swal.fire({
                    title: '<img src="/images/google-logo.png" alt="Google Logo G" style="height: 35px; margin-left: 5px; margin-right: 5px;"> Account <br>Connection Required',
                    icon: 'warning'
                })
            } else {
                Swal.fire({
                    title: 'Are you sure?',
                    text: 'Do you want to synchronize this contact with Google?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, synchronize it!'
                }).then((result) => {
                    if (result.isConfirmed) {
                        Swal.fire({
                            title: 'Synchronizing...',
                            allowOutsideClick: false,
                            didOpen: () => {
                                Swal.showLoading();
                            }
                        });

                        fetch(`/contacts/${contactId}/sync`, {
                            method: 'POST'
                        })
                        .then(response => response.json())
                        .then(data => {
                            Swal.close();
                            if (data.success) {
                                Swal.fire({
                                    title: 'Synchronized!',
                                    text: data.message,
                                    icon: 'success'
                                });
                            } else {
                                Swal.fire({
                                    title: 'Error!',
                                    text: data.message,
                                    icon: 'error'
                                });
                            }
                        })
                    }
                });
            }
        })
}

function searchContact() {
    const search = document.getElementById('searchContact').value;

    if (search === "") {
        fetchContacts();
    } else {
        fetch(`/search/${search}`)
            .then(response => response.json())
            .then(contacts => {
                const noContactsMessage = `No contacts found with the name "${search}".`;
                displayContacts(contacts, noContactsMessage);
            });
    }
}

function fetchContactsBySync(filterOption) {
    fetch(`/filter/${filterOption}`)
        .then(response => response.json())
        .then(contacts => {
            displayContacts(contacts, noContactsMessage = 'No contacts in the selected filter.');

            document.querySelectorAll('.syncGoogleCheckbox').forEach(checkbox => {
                checkbox.addEventListener('change', async (event) => {
                    const syncFilter = document.querySelector('input[name="filterOptions"]:checked').value;
                    toggleSync(event.target, syncFilter);
                });
            });
        })
        .catch(error => {
            console.error(`Error fetching contacts with sync filter '${filterOption}':`, error);
        });
}



