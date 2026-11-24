# Regras do encolhimento/ofuscação da versão de loja (minifyEnabled no build.gradle).
# Capacitor, os plugins, o RevenueCat e o Firebase já trazem as regras deles nas
# bibliotecas (consumer rules); aqui fica só o que o app precisa além disso.

# ponte entre o site e o Android: métodos chamados pelo JavaScript do WebView
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# a tela principal é aberta pelo nome no AndroidManifest
-keep class br.com.goating.app.** { *; }

# falha no Play Console com número de linha (o mapping.txt desfaz os nomes)
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod
-renamesourcefileattribute SourceFile
