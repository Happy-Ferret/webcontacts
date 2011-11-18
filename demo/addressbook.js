'use strict';

const SIMPLE_LIST_FIELDS = [
  'phoneNumbers',
  'emails',
  'addresses', // for now
  'ims',
  'urls'
];

//XXX this would be l10n'ed
const FIELD_TYPES = {
  home:   'Home',
  mobile: 'Mobile',
  work:   'Work',
  other:  'Other'
};

const PLACEHOLDERS = {
  phoneNumbers: 'Phone',
  emails:       'Email',
  addresses:    'Address',
  ims:          'IM name',
  urls:         'URL'
};

/**
 * Traverse an object structure by path and set an attribute value.
 *
 * Example:
 *
 *   let contact = {names: {}};
 *   setAttrByPath(contact, 'names.firstName', 'Bob');
 */
function setAttrByPath(obj, path, value) {
  let segments = path.split('.');
  while (segments.length - 1) {
    let attr = segments.shift();
    if (!obj[attr])
      obj[attr] = {};

    obj = obj[attr];
  }
  obj[segments[0]] = value;
}

let AddressBook = {
  init: function init() {
    this.updateContactListing();
  },

  /**
   * Prepare internal data and UI for the editing a new contact.
   * Heavy lifting is provided by the generic edit form.
   */
  newContactForm: function newContactForm() {
    document.getElementById('newContactButton').disabled = true;

    this.currentContact = {
      displayName: '',
      name: {
        familyName: '',
        givenName: '',
        honorificPrefix: '',
        honorificSuffic: '',
        middleName: ''
      },
      nickname: '',
      phoneNumbers: [],
      emails: [],
      addresses: [],
      ims: [],
      organizations: [],
      birthday: null,
      note: '',
      photos: [],
      categories: [],
      urls: []
    };

    let table = document.getElementById('contactList');
    let oldRow = table.querySelector('.selected');
    if (oldRow) {
      oldRow.classList.remove('selected');
    }

    let tr = document.createElement('tr');
    tr.id = 'newContactRow';
    tr.classList.add('selected');

    let td = document.createElement('td');
    td.textContent = '(New contact)';
    tr.appendChild(td);

    let tbody = table.tBodies[0];
    tbody.insertBefore(tr, tbody.firstChild);

    this.editContact();
  },

  /**
   * Show the edit form for the current contact. This would either be the one
   * that's currently displayed or a new one put in place by `newContactForm()`.
   */
  editContact: function editContact() {
    let contact = this.currentContact;

    document.getElementById('edit.name.givenName').value =
      contact.name.givenName || '';
    document.getElementById('edit.name.familyName').value =
      contact.name.familyName || '';
    document.getElementById('edit.birthday').value = contact.birthday || '';
    document.getElementById('edit.note').value = contact.note || '';

    SIMPLE_LIST_FIELDS.forEach((function(field) {
      let value = contact[field];
      if (!value) {
        value = contact[field] = [];
      }

      for (let i = 0; i < value.length; i++) {
        this.newSimpleListEntry(field, i);
      }

      // Just create an empty row.
      if (!value.length) {
        this.newSimpleListEntry(field);
      }
    }).bind(this));

    document.getElementById('contactEdit').style.display = 'block';
    document.getElementById('contactView').style.display = 'none';
  },

  /**
   * Create a new form fields for a simple list entry (e.g. email, IM, etc.)
   *
   * @param kind
   *        String indicating which simple list to create the entry in.
   * @param index [optional]
   *        Index of an existing entry to prefill form fields with. If this
   *        is not provided, an empty entry is created and appended to the
   *        end of the list.
   */
  newSimpleListEntry: function newSimpleListEntry(kind, index) {
    let kindList = this.currentContact[kind];
    let entry;
    if (index == null) {
      index = kindList.length;
      entry = kindList[index] = { type: '', value: '', pref: false };
    } else {
      entry = kindList[index];
    }

    let fieldset = document.getElementById('edit.fieldset.' + kind);
    let kindListId = 'edit.' + kind + '.' + index;
    let div = document.createElement('div');
    div.id = kindListId;
    div.classList.add('simpleListEntry');

    let select = document.createElement('select');
    select.id = kindListId + '.type';
    for (let fieldType in FIELD_TYPES) {
      let option = document.createElement('option');
      option.value = fieldType;
      option.textContent = FIELD_TYPES[fieldType];

      if (fieldType == entry.type) {
        option.selected = 'selected';
      }
      select.appendChild(option);
    }
    div.appendChild(select);

    //TODO automatically figure out which one of the types isn't selected yet
    // so we can select one of the other.

    let input = document.createElement('input');
    input.id = kindListId + '.value';
    input.placeholder = PLACEHOLDERS[kind];
    input.value = entry.value || '';
    div.appendChild(input);

    let button = document.createElement('button');
    button.id = kindListId + '.remove';
    button.setAttribute('onclick', 'AddressBook.removeSimpleListEntry("' +
                                    kind + '", ' + index + ');');
    button.textContent = '-';
    div.appendChild(button);
    //TODO hide button if it's the last entry

    let addbutton = document.getElementById('edit.' + kind + '.add');
    fieldset.insertBefore(div, addbutton);
  },

  /**
   * Remove an entry from a simple list
   *
   * @param kind
   *        String indicating whichsimple list to remove the entry from.
   * @param index
   *        Index of the entry to remove.
   */
  removeSimpleListEntry: function removeMultiListEntry(kind, index) {
    let kindListId = 'edit.' + kind + '.' + index;
    let div = document.getElementById(kindListId);
    div.parentNode.removeChild(div);

    let kindList = this.currentContact[kind];
    kindList.splice(index, 1);

    // Rename all following fields.
    let prefix = 'edit.' + kind + '.';
    for (let i = index; i < kindList.length; i++) {
      let oldPrefix = prefix + (i + 1);
      let newPrefix = prefix + i;
      document.getElementById(oldPrefix).id = newPrefix;
      document.getElementById(oldPrefix + '.type').id = newPrefix + '.type';
      document.getElementById(oldPrefix + '.value').id = newPrefix + '.value';
      let button = document.getElementById(oldPrefix + '.remove');
      button.id = newPrefix + '.remove';
      button.setAttribute('onclick', 'AddressBook.removeSimpleListEntry("' +
                                      kind + '", ' + i + ');');
    }
  },

  /**
   * Hide the edit form.
   */
  closeContactEditForm: function closeContactEditForm() {
    document.getElementById('newContactButton').disabled = false;
    document.getElementById('errorMsg').textContent = '';

    let table = document.getElementById('contactList');
    let newRow = table.querySelector('#newContactRow');
    if (newRow) {
      newRow.parentNode.removeChild(newRow);
    }

    let form = document.getElementById('contactEdit');
    form.style.display = 'none';

    // Remove all dynamically created elements from the form.
    let simpleListEntries = form.querySelectorAll('.simpleListEntry');
    for (let i = 0; i < simpleListEntries.length; i++) {
      let element = simpleListEntries[i];
      element.parentNode.removeChild(element);
    }

    // Re-enable form fields and reset to default values.
    form.reset();
    let fields = form.elements;
    for (let i = 0; i < fields.length; i++) {
      let field = fields[i];
      field.disabled = false;
    }
  },

  /**
   * Hide the edit form and update UI after canceling out of the edit form.
   */
  cancelContactEditForm: function cancelContactEditForm() {
    this.closeContactEditForm();
    this.updateContactListing();
  },

  /**
   * Save the contact that was edited to the database.
   */
  saveContact: function saveContact() {
    let record = this.currentContact;

    let form = document.getElementById('contactEdit');
    let fields = form.elements;
    for (let i = 0; i < fields.length; i++) {
      let field = fields[i];
      if (['fieldset', 'button'].indexOf(field.localName) != -1) {
        continue;
      }

      let property = field.id.slice('edit.'.length);
      console.log(field.localName + '#' + field.id, '->', field.value);
      if (field.value) {
        setAttrByPath(record, property, field.value);
      }

      field.disabled = true;
    }

    // Filter invalid entries from list.
    SIMPLE_LIST_FIELDS.forEach(function(field) {
      let list = record[field];
      if (!list) {
        return;
      }

      record[field] = list.filter(function(entry) {
        return entry.value;
      });
    });

    //TODO this is a locale setting
    record.displayName = record.name.givenName + ' ' + record.name.familyName;

    if (!this.currentContact.id) {
      console.log('Adding to the addressbook', record);
      window.navigator.mozContacts.create(this.contactSaved.bind(this),
                                          this.displayErrorMsg.bind(this),
                                          record);
    } else {
      console.log('Updating the addressbook', record);
      window.navigator.mozContacts.update(this.contactSaved.bind(this, record),
                                          this.displayErrorMsg,
                                          record);
    }
  },

  /**
   * Callback for `saveContact()`
   */
  contactSaved: function contactSaved(contact) {
    this.closeContactEditForm();
    this.updateContactListing(contact.id);
  },

  displayErrorMsg: function displayErrorMsg(error) {
    console.error('There was an error adding contact', error);
    document.getElementById('errorMsg').textContent =
      'There was an error adding the contact to your addressbook.';

    let form = document.getElementById('new_contact');
    let fields = form.elements;
    for (let i = 0; i < fields.length; i++) {
      let field = fields[i];
      field.disabled = false;
    }
  },

  /**
   * Load contacts from the database and refresh the listing.
   *
   * @param selected_id [optional]
   *        ID of the record that's to be selected
   */
  updateContactListing: function updateContactListing(selectedId) {
    window.navigator.mozContacts.find(['id', 'displayName'],
                                      (function(contacts) {
      this.displayContactList(contacts);
      if (selectedId) {
        let row = document.getElementById(selectedId);
        row.classList.add('selected');
        this.updateContactDetails(selectedId);
      }
    }).bind(this));
  },

  /**
   * Callback for `updateContactListing()`
   */
  displayContactList: function displayContactList(contacts) {
    // Nuke existing content from the table.
    let table = document.getElementById('contactList');
    while (table.tBodies.length) {
      table.removeChild(table.tBodies[0]);
    }

    let tbody = document.createElement('tbody');
    if (!contacts.length) {
      let tr = document.createElement('tr');
      tbody.appendChild(tr);
      let td = document.createElement('td');
      tr.appendChild(td);
      td.textContent = '(No contacts)';
    }

    for (let i = 0; i < contacts.length; i++) {
      let contact = contacts[i];

      let tr = document.createElement('tr');
      tr.id = contact.id;
      tbody.appendChild(tr);
      let td = document.createElement('td');
      tr.appendChild(td);
      td.textContent = contact.displayName;
    }
    table.appendChild(tbody);
  },

  onContactListClick: function onContactListClick(event) {
    let row = event.target;
    while (row.localName != 'tr') {
      row = row.parentNode;
      if (!row) {
        return;
      }
    }

    let table = document.getElementById('contactList');
    let oldRow = table.querySelector('.selected');
    if (oldRow) {
      oldRow.classList.remove('selected');
    }

    row.classList.add('selected');
    let contactId = row.id;
    console.log('Selected', contactId);
    this.updateContactDetails(contactId);
  },

  /**
   * Show a particular contact's details.
   */
  updateContactDetails: function updateContactDetails(contactId) {
    window.navigator.mozContacts.find(['id', /*ALL OF THEM*/],
                                      this.displayContactDetails.bind(this),
                                      function(error) { /* TODO */ },
                                      { filter: { id: contactId } });
  },

  /**
   * Callback for `updateContactDetails()`.
   */
  displayContactDetails: function displayContactDetails(contacts) {
    this.closeContactEditForm();

    console.log('Should get one contact:', contacts.length);
    let contact = this.currentContact = contacts[0];
    if (!contact) {
      return;
    }

    document.getElementById('view.displayName').textContent =
      contact.displayName;

    let tbody = document.createElement('tbody');
    SIMPLE_LIST_FIELDS.forEach(function(field) {
      let table = document.getElementById('view.' + field);
      while (table.tBodies.length) {
        table.removeChild(table.tBodies[0]);
      }

      let tbody = document.createElement('tbody');

      let value = contact[field];
      if (!value || !value.length) {
        return;
      }

      value.forEach(function(entry) {
        if (!entry.value) {
          return;
        }

        let tr = document.createElement('tr');
        let typeLabel = document.createElement('th');
        typeLabel.textContent = FIELD_TYPES[entry.type] || entry.type;
        tr.appendChild(typeLabel);

        let value = document.createElement('td');
        value.textContent = entry.value;
        tr.appendChild(value);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
    });

    if (contact.birthday) {
      document.getElementById('view.birthday').textContent =
        contact.birthday; //TODO format
    } else {
      document.getElementById('view.birthday').textContent = '';
    }
    document.getElementById('view.note').textContent = contact.note || '';

    document.getElementById('contactView').style.display = 'block';
  },

  /**
   * Delete the currently selected contact.
   */
  deleteContact: function deleteContact() {
    let table = document.getElementById('contactList');
    let row = table.querySelector('.selected');
    if (!row) {
      console.log('Could not find any selected element.');
      return;
    }

    let contactId = row.id;
    window.navigator.mozContacts.delete(this.contactDeleted.bind(this),
                                        this.displayErrorMsg.bind(this),
                                        contactId);
  },

  /**
   * Callback for `deleteContact()`.
   */
  contactDeleted: function contactDeleted() {
    let table = document.getElementById('contactList');
    let row = table.querySelector('.selected');
    row.parentNode.removeChild(row);
    document.getElementById('contactView').style.display = 'none';
  },

  onFilterKeyUp: function onFilterKeyUp(event) {
    console.log(event.keyCode, event.charCode, event.target.value);
    let query = event.target.value;
    let fields = ['displayName']; //TODO
    window.navigator.mozContacts.find(['id', /*ALL OF THEM*/],
                                      this.displayContactList.bind(this),
                                      function(error) { /* TODO */ },
                                      {search: {query: query, fields: fields}});
  },

  clearFilter: function clearFilter() {
    document.getElementById('filter').value = '';
    this.updateContactListing();
  }
};

