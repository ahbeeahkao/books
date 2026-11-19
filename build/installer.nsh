!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Complete Uninstall: Do you also want to remove Frappe Books app data and logs in AppData? (Your .db accounting files saved elsewhere will not be deleted.)" IDNO skipAppDataDelete
    RMDir /r "$APPDATA\frappe-books"
    RMDir /r "$LOCALAPPDATA\frappe-books-updater"
  skipAppDataDelete:
!macroend
