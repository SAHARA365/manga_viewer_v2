Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

' VBS自身のフォルダを取得して移動
folder = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = folder

' サーバーをバックグラウンド起動
shell.Run "cmd /c start /min node server.js", 0, False

' 1.5秒ほど待機（サーバー起動の猶予）
WScript.Sleep 1000

' ブラウザを開く
shell.Run "http://localhost:3000/"
