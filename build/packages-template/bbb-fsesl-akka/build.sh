#!/bin/bash -ex

TARGET=`basename $(pwd)`


PACKAGE=$(echo $TARGET | cut -d'_' -f1)
DISTRO=$(echo $TARGET | cut -d'_' -f3)

##

EPHEMERAL_VERSION=0.0.$(date +%s)-SNAPSHOT
sed -i "s|\(version := \)\".*|\1\"$EPHEMERAL_VERSION\"|g" bbb-common-message/build.sbt
find -name build.gradle -exec sed -i "s|\(.*org.bigbluebutton.*bbb-common-message[^:]*\):.*|\1:$EPHEMERAL_VERSION'|g" {} \;
find -name build.sbt -exec sed -i "s|\(.*org.bigbluebutton.*bbb-common-message[^\"]*\"[ ]*%[ ]*\)\"[^\"]*\"\(.*\)|\1\"$EPHEMERAL_VERSION\"\2|g" {} \;

sed -i "s|\(version := \)\".*|\1\"$EPHEMERAL_VERSION\"|g" bbb-fsesl-client/build.sbt
find -name build.gradle -exec sed -i "s|\(.*org.bigbluebutton.*bbb-fsesl-client[^:]*\):.*|\1:$EPHEMERAL_VERSION'|g" {} \;
find -name build.sbt -exec sed -i "s|\(.*org.bigbluebutton.*bbb-fsesl-client[^\"]*\"[ ]*%[ ]*\)\"[^\"]*\"\(.*\)|\1\"$EPHEMERAL_VERSION\"\2|g" {} \;

build_common_messages () {
    cd bbb-common-message
    sbt publish
    sbt publishLocal
}

build_fsesl_client () {
    cd bbb-fsesl-client
    sbt publish
    sbt publishLocal
}

# build these two in parallel
build_common_messages &
build_fsesl_client &
wait

cd akka-bbb-fsesl
sed -i 's/\r$//' project/Dependencies.scala
sed -i 's|\(val bbbCommons = \)"[^"]*"$|\1"EPHEMERAL_VERSION"|g' project/Dependencies.scala
sed -i 's|\(val bbbFsesl = \)"[^"]*"$|\1"EPHEMERAL_VERSION"|g' project/Dependencies.scala
sed -i "s/EPHEMERAL_VERSION/$EPHEMERAL_VERSION/g" project/Dependencies.scala

echo "enablePlugins(SystemdPlugin)" >> build.sbt
echo "serverLoading in Debian := Some(com.typesafe.sbt.packager.archetypes.systemloader.ServerLoader.Systemd)" >> build.sbt
mkdir -p src/templates
echo '#JAVA_OPTS="-Dconfig.file=/usr/share/bbb-fsesl-akka/conf/application.conf $JAVA_OPTS"' > src/templates/etc-default

sed -i "s/^version .*/version := \"$VERSION\"/g" build.sbt
if [[ -n $EPOCH && $EPOCH -gt 0 ]] ; then
    echo 'version in Debian := "'$EPOCH:$VERSION'"' >> build.sbt
fi
sbt debian:packageBin
cp ./target/*.deb ..

##
