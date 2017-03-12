import React from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router'
import { validateProfile } from '../util/FormValidations'
import InputField from '../form/InputField'
import TextArea from '../form/TextArea'
import SelectInput from '../form/SelectInput'

class ProfileForm extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      user_id: this.props.user.id,
      first_name: '',
      last_name: '',
      profession: '',
      skill_level: '',
      description: '',
      errors: {},
      helpers: {}
    }
  }

  onChange = (e) => {
    this.setState({
      [e.target.name]: e.target.value
    })
  }

  isValid = () => {
    const { isValid, errors } = validateProfile(this.state)
    if(!isValid) {
      this.setState({
        errors: errors
      })
      return false
    }

    return true
  }

  onSubmit = (e) => {
    e.preventDefault()
    this.setState({
      errors: {}
    })
    if(this.isValid()) {
      this.context.router.push('/')
    }
  }

  render() {
    const { first_name, last_name, profession, skill_level, description, errors, helpers } = this.state

    const isNewSubHeading = ( <h4 className="subtitle">Create your profile now to help other understand who you are and what you do!</h4> )
    const isUpdateSubHeading = ( <h4 className="subtitle">Update your profile!</h4> )

    return (
      <section className="section">
      <div className="container">
        <div className="columns">    
          <div className="column is-half is-offset-one-quarter">
            <div className="heading">
              <h3 className="title">Profile</h3>
              { this.props.isNew ? isNewSubHeading : isUpdateSubHeading}
            </div>
            <form onSubmit={this.onSubmit}>
              <div className="control is-grouped">
                  <InputField
                    name="first_name"
                    label="First Name"
                    value={first_name}
                    placholder="First Name"
                    onChange={this.onChange}
                    error={errors.first_name}
                  />

                  <InputField
                    name="last_name"
                    label="Last Name"
                    value={last_name}
                    placholder="Last Name"
                    onChange={this.onChange}
                    error={errors.last_name}
                  />
              </div>

              <div className="control is-grouped">
                <SelectInput
                  label="Profession"
                  name="profession"
                  value={profession}
                  placeholder="Profession"
                  onChange={this.onChange}
                  error={errors.profession}
                  options={['Designer', 'Developer']}
                />
                
                <SelectInput
                  label="Skill Level"
                  name="skill_level"
                  value={skill_level}
                  placeholder="Skill Level"
                  onChange={this.onChange}
                  error={errors.skill_level}
                  options={['Beginner', 'Intermediate', 'Advanced']}
                />
              </div>

              <TextArea
                label="Description"
                name="description"
                value={description}
                placholder="Talk about you a little!"
                onChange={this.onChange}
                error={errors.description}
              />

              <div className="control is-grouped">
                <p className="control">
                  <button className="button is-primary" type="submit">Save Profile</button>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
    )
  }
}

ProfileForm.contextTypes = {
  router: React.PropTypes.object.isRequired
}

const mapStateToProps = (state) => ({
  user: state.auth.user
})

export default connect(mapStateToProps)(ProfileForm)
