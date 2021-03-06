package dmsgpty

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"github.com/SkycoinProject/dmsg/cipher"
)

// Version of the protocol.
// Increment this on every revision.
const Version = "1.0"

// CLI request types.
const (
	CfgReqType byte = iota
	PtyReqType
)

// Request represents a request from CLI to host.
type Request interface {
	Type() byte
	SetVersion(version string)
}

// CfgReq represents a 'Cfg' type request.
type CfgReq struct {
	Version string
}

// Type implements Request.
func (CfgReq) Type() byte { return CfgReqType }

// SetVersion implements Request.
func (r *CfgReq) SetVersion(version string) { r.Version = version }

// PtyReq represents a 'Pty' type request.
type PtyReq struct {
	Version string
	DstPK   cipher.PubKey
	DstPort uint16
}

// Type implements Request.
func (PtyReq) Type() byte { return PtyReqType }

// SetVersion implements Request.
func (r *PtyReq) SetVersion(version string) { r.Version = version }

// WriteRequest writes a request.
func WriteRequest(w io.Writer, req Request) error {
	req.SetVersion(Version)

	b, err := json.Marshal(req)
	if err != nil {
		panic(fmt.Errorf("WriteRequest: %v", err))
	}
	if _, err := w.Write([]byte{req.Type()}); err != nil {
		return err
	}
	if err := binary.Write(w, binary.BigEndian, uint16(len(b))); err != nil {
		return err
	}
	_, err = w.Write(b)
	return err
}

// ReadRequest reads a request.
func ReadRequest(r io.Reader) (Request, error) {
	reqT, err := readReqType(r)
	if err != nil {
		return nil, err
	}

	reqB, err := readReqBody(r)
	if err != nil {
		return nil, err
	}

	switch reqT {
	case CfgReqType:
		req := new(CfgReq)
		err := json.Unmarshal(reqB, req)
		return req, err
	case PtyReqType:
		req := new(PtyReq)
		err := json.Unmarshal(reqB, req)
		return req, err
	default:
		return nil, errors.New("invalid request type")
	}
}

func readReqType(r io.Reader) (byte, error) {
	b := make([]byte, 1)
	_, err := io.ReadFull(r, b)
	return b[0], err
}

func readReqBody(r io.Reader) ([]byte, error) {
	var dl uint16
	if err := binary.Read(r, binary.BigEndian, &dl); err != nil {
		return nil, err
	}
	d := make([]byte, dl)
	_, err := io.ReadFull(r, d)
	return d, err
}
