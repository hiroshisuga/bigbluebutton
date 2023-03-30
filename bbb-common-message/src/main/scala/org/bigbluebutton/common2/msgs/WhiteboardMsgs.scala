package org.bigbluebutton.common2.msgs

case class AnnotationVO(id: String, status: String, annotationType: String,
                        annotationInfo: scala.collection.immutable.Map[String, Any], wbId: String, userId: String, position: Int)

// ------------ client to akka-apps ------------
object ClientToServerLatencyTracerMsg { val NAME = "ClientToServerLatencyTracerMsg" }
case class ClientToServerLatencyTracerMsg(header: BbbClientMsgHeader, body: ClientToServerLatencyTracerMsgBody) extends StandardMsg
case class ClientToServerLatencyTracerMsgBody(timestampUTC: Long, rtt: Long, senderId: String)

object ClearWhiteboardPubMsg { val NAME = "ClearWhiteboardPubMsg" }
case class ClearWhiteboardPubMsg(header: BbbClientMsgHeader, body: ClearWhiteboardPubMsgBody) extends StandardMsg
case class ClearWhiteboardPubMsgBody(whiteboardId: String)

object GetWhiteboardAnnotationsReqMsg { val NAME = "GetWhiteboardAnnotationsReqMsg" }
case class GetWhiteboardAnnotationsReqMsg(header: BbbClientMsgHeader, body: GetWhiteboardAnnotationsReqMsgBody) extends StandardMsg
case class GetWhiteboardAnnotationsReqMsgBody(whiteboardId: String)

object ModifyWhiteboardAccessPubMsg { val NAME = "ModifyWhiteboardAccessPubMsg" }
case class ModifyWhiteboardAccessPubMsg(header: BbbClientMsgHeader, body: ModifyWhiteboardAccessPubMsgBody) extends StandardMsg
case class ModifyWhiteboardAccessPubMsgBody(whiteboardId: String, multiUser: Array[String])

object ModifyWBModePubMsg { val NAME = "ModifyWBModePubMsg" }
case class ModifyWBModePubMsg(header: BbbClientMsgHeader, body: ModifyWBModePubMsgBody) extends StandardMsg
case class ModifyWBModePubMsgBody(meetingId: String, whiteboardMode: Map[String, Boolean])

object SendCursorPositionPubMsg { val NAME = "SendCursorPositionPubMsg" }
case class SendCursorPositionPubMsg(header: BbbClientMsgHeader, body: SendCursorPositionPubMsgBody) extends StandardMsg
case class SendCursorPositionPubMsgBody(whiteboardId: String, xPercent: Double, yPercent: Double)

object SendWhiteboardAnnotationPubMsg { val NAME = "SendWhiteboardAnnotationPubMsg" }
case class SendWhiteboardAnnotationPubMsg(header: BbbClientMsgHeader, body: SendWhiteboardAnnotationPubMsgBody) extends StandardMsg
case class SendWhiteboardAnnotationPubMsgBody(annotation: AnnotationVO, html5InstanceId: String)

object UndoWhiteboardPubMsg { val NAME = "UndoWhiteboardPubMsg" }
case class UndoWhiteboardPubMsg(header: BbbClientMsgHeader, body: UndoWhiteboardPubMsgBody) extends StandardMsg
case class UndoWhiteboardPubMsgBody(whiteboardId: String)

object RemoveWhiteboardAnnotationsPubMsg { val NAME = "RemoveWhiteboardAnnotationsPubMsg" }
case class RemoveWhiteboardAnnotationsPubMsg(header: BbbClientMsgHeader, body: RemoveWhiteboardAnnotationsPubMsgBody) extends StandardMsg
case class RemoveWhiteboardAnnotationsPubMsgBody(whiteboardId: String, selectedAnnotations: Array[Map[String, String]])

object MoveWhiteboardAnnotationsPubMsg { val NAME = "MoveWhiteboardAnnotationsPubMsg" }
case class MoveWhiteboardAnnotationsPubMsg(header: BbbClientMsgHeader, body: MoveWhiteboardAnnotationsPubMsgBody) extends StandardMsg
case class MoveWhiteboardAnnotationsPubMsgBody(whiteboardId: String, selectedAnnotations: Array[Map[String, String]], offset: Map[String, Float])

object ReorderWhiteboardAnnotationsPubMsg { val NAME = "ReorderWhiteboardAnnotationsPubMsg" }
case class ReorderWhiteboardAnnotationsPubMsg(header: BbbClientMsgHeader, body: ReorderWhiteboardAnnotationsPubMsgBody) extends StandardMsg
case class ReorderWhiteboardAnnotationsPubMsgBody(whiteboardId: String, selectedAnnotations: Array[Map[String, String]], order: Array[Map[String, String]])
// ------------ client to akka-apps ------------

// ------------ akka-apps to client ------------
object ServerToClientLatencyTracerMsg { val NAME = "ServerToClientLatencyTracerMsg" }
case class ServerToClientLatencyTracerMsg(header: BbbClientMsgHeader, body: ServerToClientLatencyTracerMsgBody) extends BbbCoreMsg
case class ServerToClientLatencyTracerMsgBody(timestampUTC: Long, rtt: Long, senderId: String)

object DoLatencyTracerMsg { val NAME = "DoLatencyTracerMsg" }
case class DoLatencyTracerMsg(header: BbbClientMsgHeader, body: DoLatencyTracerMsgBody) extends BbbCoreMsg
case class DoLatencyTracerMsgBody(timestampUTC: Long)

object ClearWhiteboardEvtMsg { val NAME = "ClearWhiteboardEvtMsg" }
case class ClearWhiteboardEvtMsg(header: BbbClientMsgHeader, body: ClearWhiteboardEvtMsgBody) extends BbbCoreMsg
case class ClearWhiteboardEvtMsgBody(whiteboardId: String, userId: String, fullClear: Boolean)

object GetWhiteboardAnnotationsRespMsg { val NAME = "GetWhiteboardAnnotationsRespMsg" }
case class GetWhiteboardAnnotationsRespMsg(header: BbbClientMsgHeader, body: GetWhiteboardAnnotationsRespMsgBody) extends BbbCoreMsg
case class GetWhiteboardAnnotationsRespMsgBody(whiteboardId: String, annotations: Array[AnnotationVO], multiUser: Array[String])

object ModifyWhiteboardAccessEvtMsg { val NAME = "ModifyWhiteboardAccessEvtMsg" }
case class ModifyWhiteboardAccessEvtMsg(header: BbbClientMsgHeader, body: ModifyWhiteboardAccessEvtMsgBody) extends BbbCoreMsg
case class ModifyWhiteboardAccessEvtMsgBody(whiteboardId: String, multiUser: Array[String])

object ModifyWBModeEvtMsg { val NAME = "ModifyWBModeEvtMsg" }
case class ModifyWBModeEvtMsg(header: BbbClientMsgHeader, body: ModifyWBModeEvtMsgBody) extends BbbCoreMsg
case class ModifyWBModeEvtMsgBody(whiteboardMode: Map[String, Boolean])

object SendCursorPositionEvtMsg { val NAME = "SendCursorPositionEvtMsg" }
case class SendCursorPositionEvtMsg(header: BbbClientMsgHeader, body: SendCursorPositionEvtMsgBody) extends BbbCoreMsg
case class SendCursorPositionEvtMsgBody(whiteboardId: String, xPercent: Double, yPercent: Double)

object SendWhiteboardAnnotationEvtMsg { val NAME = "SendWhiteboardAnnotationEvtMsg" }
case class SendWhiteboardAnnotationEvtMsg(header: BbbClientMsgHeader, body: SendWhiteboardAnnotationEvtMsgBody) extends BbbCoreMsg
case class SendWhiteboardAnnotationEvtMsgBody(annotation: AnnotationVO)

object UndoWhiteboardEvtMsg { val NAME = "UndoWhiteboardEvtMsg" }
case class UndoWhiteboardEvtMsg(header: BbbClientMsgHeader, body: UndoWhiteboardEvtMsgBody) extends BbbCoreMsg
case class UndoWhiteboardEvtMsgBody(whiteboardId: String, userId: String, annotationId: String)

object RemoveWhiteboardAnnotationsEvtMsg { val NAME = "RemoveWhiteboardAnnotationsEvtMsg" }
case class RemoveWhiteboardAnnotationsEvtMsg(header: BbbClientMsgHeader, body: RemoveWhiteboardAnnotationsEvtMsgBody) extends BbbCoreMsg
case class RemoveWhiteboardAnnotationsEvtMsgBody(whiteboardId: String, selectedAnnotations: Array[Map[String, String]], userId: String, annotationId: String)

object MoveWhiteboardAnnotationsEvtMsg { val NAME = "MoveWhiteboardAnnotationsEvtMsg" }
case class MoveWhiteboardAnnotationsEvtMsg(header: BbbClientMsgHeader, body: MoveWhiteboardAnnotationsEvtMsgBody) extends BbbCoreMsg
case class MoveWhiteboardAnnotationsEvtMsgBody(whiteboardId: String, selectedAnnotations: Array[Map[String, String]], offset: Map[String, Float], userId: String, movedAnnotationId: String)

object ReorderWhiteboardAnnotationsEvtMsg { val NAME = "ReorderWhiteboardAnnotationsEvtMsg" }
case class ReorderWhiteboardAnnotationsEvtMsg(header: BbbClientMsgHeader, body: ReorderWhiteboardAnnotationsEvtMsgBody) extends BbbCoreMsg
case class ReorderWhiteboardAnnotationsEvtMsgBody(whiteboardId: String, selectedAnnotations: Array[Map[String, String]], order: Array[Map[String, String]], userId: String)
// ------------ akka-apps to client ------------
