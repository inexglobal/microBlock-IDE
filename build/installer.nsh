!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to microBlock IDE Setup V${VERSION}"
  !define MUI_WELCOMEPAGE_TEXT "This installer will guide you through installing microBlock IDE on your computer.$\r$\n$\r$\nPlease close other applications before continuing.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro preInit
  SetRegView 64
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\mblock"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\mblock"

  SetRegView 32
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\mblock"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\mblock"
!macroend